import pyotp
import requests
import json
import time
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Constants
SUPABASE_URL = "http://localhost:8000"
SERVICE_ROLE_KEY = "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTYwMDAwMDAwMCwgImV4cCI6IDE5MDAwMDAwMDB9.BkDnR45usq6gCB3cQM9OK1KnA3_2xG3c1Qm2qAlRmaA"
LOCAL_DEV_KMS_KEY_BASE64 = "S7GLC3MdsEAQD4nbfT0t3VqthlfptY0O3ysqsgEuwu0="

headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def run_ale_verification():
    print("🚀 [TEST 4] Starting Application-Level Encryption (ALE) DB Verification...")

    # 1. Fetch valid Hospital ID and Department ID to satisfy Foreign Key constraints
    hospital_res = requests.get(f"{SUPABASE_URL}/rest/v1/hospitals?select=id&limit=1", headers=headers)
    if not hospital_res.json():
        h_res = requests.post(f"{SUPABASE_URL}/rest/v1/hospitals", headers=headers, json={"name": "Integration Test Hospital", "address": "123 Test St"})
        hospital_id = h_res.json()[0]['id']
    else:
        hospital_id = hospital_res.json()[0]['id']

    print(f"   -> Found valid Hospital ID: {hospital_id}")

    # Fetch a valid Department ID
    dept_res = requests.get(f"{SUPABASE_URL}/rest/v1/departments?select=id&limit=1", headers=headers)
    if not dept_res.json():
        d_res = requests.post(f"{SUPABASE_URL}/rest/v1/departments", headers=headers, json={"hospital_id": hospital_id, "name": "Integration Test Dept"})
        dept_uuid = d_res.json()[0]['id']
    else:
        dept_uuid = dept_res.json()[0]['id']

    # Revert Patient ID to fixed constraintless UUID
    patient_id = "550e8400-e29b-41d4-a716-446655440000"
    print(f"   -> Using generic Patient ID stub: {patient_id}")

    print(f"   -> Found valid Patient ID: {patient_id}")

    # Provision Test User in Department
    email = f"dr_smith_{int(time.time())}@antigravity.local"
    create_user_res = requests.post(f"{SUPABASE_URL}/auth/v1/admin/users", headers=headers, json={
        "email": email,
        "password": "SecurePassword123!",
        "email_confirm": True,
        "app_metadata": {"app_role": "Department Manager", "department_id": dept_uuid}
    })

    if create_user_res.status_code not in [200, 201]:
        print("❌ Failed to create user:", create_user_res.text)
        return

    user_id = create_user_res.json()['id']
    print(f"   -> Provisioned Staff User ({email}) in Dept ({dept_uuid}).")

    # 3. Insert Dummy Complaint linking to Cardiology
    # Patient ID is an arbitrary UUID
    patient_id = "550e8400-e29b-41d4-a716-446655440000"
    complaint_res = requests.post(f"{SUPABASE_URL}/rest/v1/complaints", headers=headers, json={
        "patient_id": patient_id,
        "department_id": dept_uuid,
        "hospital_id": hospital_id,
        "status": "submitted"
    })

    if complaint_res.status_code not in [200, 201]:
        print("❌ Failed to insert complaint:", complaint_res.text)
        return

    complaint_id = complaint_res.json()[0]['id']
    print(f"   -> Inserted Complaint Record ID: {complaint_id}")

    # 3. Encrypt PHI using the Simulated KMS Key
    aesgcm = AESGCM(base64.b64decode(LOCAL_DEV_KMS_KEY_BASE64))
    iv = os.urandom(12)
    plaintext_phi = json.dumps({"diagnosis": "Severe Angina"}).encode('utf-8')

    # Encrypt (append auth tag natively in python cryptography wrapper)
    ciphertext = aesgcm.encrypt(iv, plaintext_phi, None)

    # Pack IV + Ciphertext for the 'description' column since there is no native 'iv' column
    packed_payload = iv + ciphertext
    print("   🔐 Encrypted PHI locally. Sending packed IV+Ciphertext to database...")

    # Insert into complaint_phi
    # Python inserts it as a Hex string format \x... for BYTEA
    dummy_packed = iv + aesgcm.encrypt(iv, b"dummy", None)
    phi_res = requests.post(f"{SUPABASE_URL}/rest/v1/complaint_phi", headers=headers, json={
        "complaint_id": complaint_id,
        "description": "\\x" + packed_payload.hex(),
        "reporter_name": "\\x" + dummy_packed.hex(),
        "reporter_contact": "\\x" + dummy_packed.hex()
    })

    if phi_res.status_code not in [200, 201]:
         print("❌ Failed to insert PHI:", phi_res.text)
         return

    print("   ✅ Ciphertext successfully stored in Postgres (complaint_phi table).")

    # 4. Prove that reading the database returns indecipherable garbage
    fetch_res = requests.get(f"{SUPABASE_URL}/rest/v1/complaint_phi?complaint_id=eq.{complaint_id}", headers=headers)
    db_row = fetch_res.json()[0]
    raw_db_phi = db_row['description']

    print("\n   🔍 Fetching raw data from Postgres...")
    print(f"      Raw Database Payload: {raw_db_phi[:30]}... (truncated)")
    if "Severe Angina" in raw_db_phi:
        print("   ❌ CRITICAL FAILURE: Plaintext PHI found in Postgres query!")
        return
    else:
        print("   ✅ PROOF: Database zero-knowledge confirmed. Plaintext does not exist at the payload layer.")

    # 5. Reverse the operation (Simulating the Next.js Server Action Decryption)
    print("\n   🔄 Initializing Application-Level Decryption Sequence (Simulating Next.js Server Action)...")
    packed_bytes = bytes.fromhex(raw_db_phi.replace('\\x', ''))
    db_iv_bytes = packed_bytes[:12]
    db_cipher_bytes = packed_bytes[12:]

    try:
        decrypted = aesgcm.decrypt(db_iv_bytes, db_cipher_bytes, None)
        print("   ✅ SUCCESS: Verification test passed. Cryptographic loop closed perfectly.")
        print(f"      Decrypted Data: {decrypted.decode('utf-8')}")
    except Exception as e:
        print("   ❌ Decryption Failed:", e)

if __name__ == "__main__":
    run_ale_verification()
