import re

with open('supabase/docker/saml_pkcs1.key', 'r') as f:
    key_lines = [l.strip() for l in f if not l.startswith('-----') and l.strip()]
b64_key = ''.join(key_lines)

with open('supabase/docker/docker-compose.yml', 'r', encoding='utf-8') as f:
    content = f.read()

target = r"      GOTRUE_SAML_EXTERNAL_PROVIDER_LOCALHOST_X509_CERT: \|-\n.*?-----END RSA PRIVATE KEY-----"
replacement = f"      GOTRUE_SAML_PRIVATE_KEY: {b64_key}"
new_content = re.sub(target, replacement, content, flags=re.DOTALL)

with open('supabase/docker/docker-compose.yml', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Replaced YAML with single-line GOTRUE_SAML_PRIVATE_KEY length: {len(b64_key)}")
