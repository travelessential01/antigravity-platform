import os
import json
import urllib.request
import urllib.error

AUTHENTIK_URL = "http://localhost:9090"
API_TOKEN = os.environ.get("AUTHENTIK_API_TOKEN", "7fpMDzxUtbKoAWHe42Qe3wd9r1LueAkpDncAWzMWpO3R5Rgl16ea3df5Zryp")
HEADERS = {"Authorization": f"Bearer {API_TOKEN}", "Content-Type": "application/json"}

def make_request(method, url, data=None):
    req = urllib.request.Request(url, headers=HEADERS, method=method)
    if data: req.data = json.dumps(data).encode('utf-8')
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode('utf-8')) if response.length else {}
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8')) if e.fp else {}
    except Exception as e: return 0, str(e)

groups = [
    "ANTIGRAVITY_QUALITY",
    "ANTIGRAVITY_DEPT_MANAGER",
    "ANTIGRAVITY_ADMIN",
    "ANTIGRAVITY_MED_SUPT",
    "ANTIGRAVITY_DPO"
]

print("Creating Groups...")
for group in groups:
    status, data = make_request("POST", f"{AUTHENTIK_URL}/api/v3/core/groups/", {"name": group})
    if status == 201:
        print(f"Created group: {group}")
    elif status == 400 and 'name' in data:
        print(f"Group {group} already exists.")
    else:
        print(f"Failed to create {group}: {status} {data}")

print("\nCreating Property Mappings...")
role_expr = """groups = [g.name for g in request.user.ak_groups.all()]
for group in groups:
    if group == 'ANTIGRAVITY_ADMIN': return 'admin'
    if group == 'ANTIGRAVITY_QUALITY': return 'quality_coordinator'
    if group == 'ANTIGRAVITY_DEPT_MANAGER': return 'department_manager'
    if group == 'ANTIGRAVITY_MED_SUPT': return 'medical_superintendent'
    if group == 'ANTIGRAVITY_DPO': return 'dpo'
return 'patient'"""

dept_expr = """return request.user.attributes.get('department', '')"""

mappings_to_create = [
    {"name": "Antigravity Role Mapping", "saml_name": "app_role", "expression": role_expr},
    {"name": "Antigravity Department Mapping", "saml_name": "department_id", "expression": dept_expr}
]

mapping_ids = []

for m in mappings_to_create:
    status, data = make_request("POST", f"{AUTHENTIK_URL}/api/v3/propertymappings/saml/", m)
    if status == 201:
        print(f"Created mapping: {m['name']} (ID: {data.get('pk')})")
        mapping_ids.append(data.get('pk'))
    elif status == 400 and 'name' in data:
        print(f"Mapping {m['name']} already exists.")
    else:
        print(f"Failed to create mapping {m['name']}: {status} {data}")

status, data = make_request("GET", f"{AUTHENTIK_URL}/api/v3/propertymappings/saml/")
if status == 200:
    for res in data.get('results', []):
        if res['name'] in ["Antigravity Role Mapping", "Antigravity Department Mapping"] and res['pk'] not in mapping_ids:
            mapping_ids.append(res['pk'])

print(f"Mapping IDs collected: {mapping_ids}")

print("\nUpdating Provider...")
status, data = make_request("GET", f"{AUTHENTIK_URL}/api/v3/providers/saml/")
if status == 200:
    for provider in data.get('results', []):
        if provider['name'] == "Supabase GoTrue SAML":
            print(f"Found Provider: {provider['pk']}")
            existing = provider.get('property_mappings', [])
            new_mappings = list(set(existing + mapping_ids))
            patch_data = {"property_mappings": new_mappings}
            s, r = make_request("PATCH", f"{AUTHENTIK_URL}/api/v3/providers/saml/{provider['pk']}/", patch_data)
            if s == 200:
                print(f"Provider patched successfully with mappings: {new_mappings}")
            else:
                print(f"Failed to patch provider: {s} {r}")
            break
else:
    print("Failed to get providers.")
