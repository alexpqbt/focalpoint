from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
import datetime
import ipaddress
from networking import get_local_ip
from pathlib import Path

def generate_cert(ip_address, cert_path="cert.pem", key_path="key.pem", dir_path="./certs"):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, ip_address)
    ])
    cert = x509.CertificateBuilder().subject_name(subject) \
        .issuer_name(issuer) \
        .public_key(key.public_key()) \
        .serial_number(x509.random_serial_number()) \
        .not_valid_before(datetime.datetime.now(datetime.UTC)) \
        .not_valid_after(datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=365)) \
        .add_extension(
            x509.SubjectAlternativeName([
                x509.IPAddress(ipaddress.ip_address(ip_address)),
                x509.DNSName("localhost"),
            ]),
            critical=False,
        ).sign(key, hashes.SHA256())

    cert_dir = Path(dir_path)
    cert_dir.mkdir(parents=True, exist_ok=True)

    with open(cert_dir / key_path, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    with open(cert_dir / cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

if __name__ == "__main__":
    ip_address = get_local_ip()
    generate_cert(ip_address)