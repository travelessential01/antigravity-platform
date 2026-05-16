import hmac
import hashlib
import base64
import json
import os

jwt_secret = os.environ.get("JWT_SECRET")

def base64url_encode(data):
    if isinstance(data, str):
        data = data.encode('utf-8')
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def create_jwt(role):
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"role": role, "iss": "supabase", "iat": 1600000000, "exp": 1900000000}

    header_enc = base64url_encode(json.dumps(header))
    payload_enc = base64url_encode(json.dumps(payload))

    message = f"{header_enc}.{payload_enc}"
    signature = hmac.new(jwt_secret.encode('utf-8'), message.encode('utf-8'), hashlib.sha256).digest()
    signature_enc = base64url_encode(signature)

    return f"{message}.{signature_enc}"

env_path = r"c:\Application V4.0\.env"
with open(env_path, "r") as f:
    lines = f.readlines()

jwt_secret = next((line.split("=")[1].strip() for line in lines if line.startswith("JWT_SECRET=")), None)

if jwt_secret:
    anon = create_jwt("anon")
    service = create_jwt("service_role")

    new_lines = []
    for line in lines:
        if line.startswith("ANON_KEY="):
            new_lines.append(f"ANON_KEY={anon}\n")
        elif line.startswith("SERVICE_ROLE_KEY="):
            new_lines.append(f"SERVICE_ROLE_KEY={service}\n")
        elif line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
            new_lines.append(f"NEXT_PUBLIC_SUPABASE_ANON_KEY={anon}\n")
        elif line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            new_lines.append(f"SUPABASE_SERVICE_ROLE_KEY={service}\n")
        else:
            new_lines.append(line)

    with open(env_path, "w") as f:
        f.writelines(new_lines)
    print("Successfully replaced broken keys in .env")

    # Also update supabase docker env if present
    supa_env_path = r"c:\Application V4.0\supabase\docker\.env"
    if os.path.exists(supa_env_path):
        with open(supa_env_path, "r") as f:
            slines = f.readlines()
        snew_lines = []
        for line in slines:
            if line.startswith("ANON_KEY="):
                snew_lines.append(f"ANON_KEY={anon}\n")
            elif line.startswith("SERVICE_ROLE_KEY="):
                snew_lines.append(f"SERVICE_ROLE_KEY={service}\n")
            else:
                snew_lines.append(line)
        with open(supa_env_path, "w") as f:
            f.writelines(snew_lines)
        print("Successfully replaced broken keys in supabase/docker/.env")
else:
    print("Could not find JWT_SECRET")
