import os
import json
import urllib.request
import urllib.error

env_path = r"c:\Application V4.0\.env"
with open(env_path, "r") as f:
    lines = f.readlines()

def get_env(key):
    val = os.environ.get(key)
    if val: return val
    return next((line.split("=", 1)[1].strip() for line in lines if line.startswith(key + "=")), None)

SUPABASE_URL = "http://localhost:8000"
SERVICE_ROLE_KEY = get_env("SERVICE_ROLE_KEY")
METADATA_URL = get_env("AUTHENTIK_SAML_METADATA_URL")

if not SERVICE_ROLE_KEY:
    print("Error: SERVICE_ROLE_KEY is missing from environment variables.")
    exit(1)
print(f"DEBUG ROLE KEY: {SERVICE_ROLE_KEY[:15]}...{SERVICE_ROLE_KEY[-15:]}")

if not METADATA_URL:
    print("Error: AUTHENTIK_SAML_METADATA_URL is missing.")
    exit(1)

HEADERS = {
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "apikey": SERVICE_ROLE_KEY,
    "Content-Type": "application/json"
}

def register_saml_provider():
    url = f"{SUPABASE_URL}/auth/v1/admin/sso/providers"

    # Supabase requires HTTPS for metadata_url. Since we're local, we fetch the XML and push it directly.
    req_xml = urllib.request.Request(METADATA_URL, method="GET")
    try:
        with urllib.request.urlopen(req_xml) as resp:
            xml_data = resp.read().decode('utf-8')
    except Exception as e:
        print(f"Failed to fetch metadata XML from Authentik: {e}")
        return

    payload = {
        "type": "saml",
        "metadata_xml": xml_data,
        "attribute_mapping": {
            "keys": {
                "email": {
                    "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
                }
            }
        }
    }

    req = urllib.request.Request(url, headers=HEADERS, method="POST")
    req.data = json.dumps(payload).encode('utf-8')

    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            data = json.loads(response.read().decode('utf-8')) if response.length else {}
            print(f"Success! Registered SAML Provider: {data}")
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} - {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    print(f"Registering SAML Provider using Metadata URL: {METADATA_URL}")
    register_saml_provider()
