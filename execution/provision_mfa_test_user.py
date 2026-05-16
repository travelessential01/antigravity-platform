import os
import requests
import json
from time import sleep

# Load keys from docker-compose or .env
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "http://localhost:8000"
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY.")

headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json"
}

print("Provisoning Test MFA Admin User...")

# 1. Create User
user_data = {
    "email": "mfa_admin@antigravity.local",
    "password": "SecurePassword123!",
    "email_confirm": True,
    "app_metadata": {
        "app_role": "Admin",
        "department_id": "HQ"
    }
}

response = requests.post(
    f"{SUPABASE_URL}/auth/v1/admin/users",
    headers=headers,
    json=user_data
)

if response.status_code in [200, 201]:
    print("User created successfully.")
elif response.status_code == 422 and "already registered" in response.text:
    print("User already exists. Updating role instead...")
    # Find user ID
    users_resp = requests.get(f"{SUPABASE_URL}/auth/v1/admin/users", headers=headers)
    users = users_resp.json().get('users', [])
    user_id = next((u['id'] for u in users if u['email'] == "mfa_admin@antigravity.local"), None)

    if user_id:
        # Update user app_metadata
        update_resp = requests.put(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers=headers,
            json={"app_metadata": {"app_role": "Admin", "department_id": "HQ"}}
        )
        print("User updated:", update_resp.status_code)
else:
    print("Error creating user:", response.status_code, response.text)

print("Done.")
