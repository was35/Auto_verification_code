import secrets
import string

def generate_api_token(length=32):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_device_uuid():
    return secrets.token_hex(8)
