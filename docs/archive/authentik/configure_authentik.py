import os
import json
import time
import urllib.request
import urllib.error

AUTHENTIK_URL = "http://localhost:9090"
API_TOKEN = os.environ.get("AUTHENTIK_API_TOKEN")

if not API_TOKEN:
    print("Please set the AUTHENTIK_API_TOKEN environment variable.")
    exit(1)

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

def make_request(method, url, data=None):
    req = urllib.request.Request(url, headers=HEADERS, method=method)
    if data:
        req.data = json.dumps(data).encode('utf-8')
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode('utf-8')) if response.length else {}
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')
    except Exception as e:
        return 0, str(e)

def wait_for_authentik():
    print("Waiting for Authentik API to be ready...")
    for _ in range(30):
        status, debug_out = make_request("GET", f"{AUTHENTIK_URL}/api/v3/core/users/me/")
        if status == 200:
            print("Authentik API is reachable!")
            return True
        else:
            print(f"Failed with status: {status}, detail: {debug_out}")
        time.sleep(2)
    print("Authentik API did not become ready in time.")
    return False

def create_saml_provider():
    print("Creating SAML Provider for Supabase...")

    status, flows_data = make_request("GET", f"{AUTHENTIK_URL}/api/v3/flows/instances/?designation=authorization")
    flows = flows_data.get('results', []) if isinstance(flows_data, dict) else []
    auth_flow_id = None
    for f in flows:
        if f['slug'] == 'default-provider-authorization-explicit-consent':
            auth_flow_id = f['pk']
            break
    if not auth_flow_id and len(flows) > 0:
        auth_flow_id = flows[0]['pk']

    status, mappings_data = make_request("GET", f"{AUTHENTIK_URL}/api/v3/propertymappings/saml/")
    mappings = mappings_data.get('results', []) if isinstance(mappings_data, dict) else []
    email_mapping_id = None
    for m in mappings:
        if 'email' in m['name'].lower() or 'mail' in m['name'].lower():
            email_mapping_id = m['pk']
            break

    provider_data = {
        "name": "Supabase GoTrue SAML",
        "authorization_flow": auth_flow_id,
        "acs_url": "http://localhost:8000/auth/v1/sso/saml/acs",
        "audience": "http://localhost:8000",
        "issuer": "http://localhost:8000",
        "sp_binding": "post",
        "sign_assertion": True,
        "sign_response": True
    }

    if email_mapping_id:
        provider_data["property_mappings"] = [email_mapping_id]
        provider_data["name_id_mapping"] = email_mapping_id

    status, response_data = make_request("POST", f"{AUTHENTIK_URL}/api/v3/providers/saml/", provider_data)

    if status == 201:
        print("SAML Provider created successfully!")
        return response_data.get('pk')
    else:
        print(f"Failed to create Provider: {response_data}")
        return None

def create_application(provider_id):
    print("Creating Authentik Application...")
    app_data = {
        "name": "Antigravity Supabase",
        "slug": "antigravity-supabase",
        "provider": provider_id,
        "meta_launch_url": "http://localhost:3000/login"
    }
    status, response_data = make_request("POST", f"{AUTHENTIK_URL}/api/v3/core/applications/", app_data)
    if status == 201:
        print("Application created successfully!")
    else:
        print(f"Failed to create Application: {response_data}")

def get_metadata_url(provider_id):
    return f"{AUTHENTIK_URL}/api/v3/providers/saml/{provider_id}/metadata/?download"

if __name__ == "__main__":
    if wait_for_authentik():
        provider_pk = create_saml_provider()
        if provider_pk:
            create_application(provider_pk)
            metadata_url = get_metadata_url(provider_pk)
            print("\n==============================================")
            print("AUTHENTIK CONFIGURED SUCCESSFULLY!")
            print(f"SAML METADATA URL: {metadata_url}")
            print("==============================================\n")
            print("You can pass this URL to Supabase now to link them.")
