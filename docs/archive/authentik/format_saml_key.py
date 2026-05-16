import sys
import re

def format_gotrue_saml_key(pem_file_path):
    try:
        with open(pem_file_path, 'r') as file:
            pem_data = file.read()

        # Strip out the PEM headers, footers, and any newlines/whitespace
        raw_base64 = re.sub(r'-+BEGIN.*?KEY-+', '', pem_data)
        raw_base64 = re.sub(r'-+END.*?KEY-+', '', raw_base64)

        # Remove all whitespace and newline characters
        raw_base64 = "".join(raw_base64.split())

        return raw_base64

    except FileNotFoundError:
        print(f"Error: Could not find file at '{pem_file_path}'")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python format_saml_key.py <path_to_pem_file>")
        sys.exit(1)

    pem_path = sys.argv[1]
    formatted_key = format_gotrue_saml_key(pem_path)

    print("\n✅ Success! Inject the following string into your Docker config as GOTRUE_SAML_PRIVATE_KEY:\n")
    print(formatted_key)
    print("\n")
