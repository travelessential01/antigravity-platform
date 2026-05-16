import os
import json
import urllib.request

AUTHENTIK_URL = "http://localhost:9090"
API_TOKEN = os.environ.get("AUTHENTIK_API_TOKEN", "7fpMDzxUtbKoAWHe42Qe3wd9r1LueAkpDncAWzMWpO3R5Rgl16ea3df5Zryp")
HEADERS = {"Authorization": f"Bearer {API_TOKEN}", "Content-Type": "application/json"}

def make_request(method, url, data=None):
    req = urllib.request.Request(url, headers=HEADERS, method=method)
    if data: req.data = json.dumps(data).encode('utf-8')
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode('utf-8')) if response.length else {}
    except Exception as e: return 0, str(e)

# Fetch providers
status, data = make_request("GET", f"{AUTHENTIK_URL}/api/v3/providers/saml/")
if status == 200:
    for provider in data.get('results', []):
        if provider['name'] == "Supabase GoTrue SAML":
            print(f"Updating Provider: {provider['pk']}")

            patch_data = {
                "audience": "http://localhost:8000/auth/v1",
                "issuer": "http://localhost:8000/auth/v1"
            }
            s, r = make_request("PATCH", f"{AUTHENTIK_URL}/api/v3/providers/saml/{provider['pk']}/", patch_data)
            print(f"Patch status: {s}")
            break
else:
    print("Failed to get providers.")
