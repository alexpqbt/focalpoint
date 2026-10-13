import os
import yaml
from dotenv import load_dotenv
from networking import get_local_ip
from pathlib import Path
from paths import BASE

load_dotenv(BASE / ".env")

def generate_livekit_yaml(local_ip):
    config = {
        "port": 7880,
        "rtc": {
            "tcp_port": 7881,
            "port_range_start": 50000,
            "port_range_end": 60000,
            "use_external_ip": False,
            "node_ip": local_ip,
        },
        "keys": {
            os.getenv("LIVEKIT_API_KEY"): os.getenv("LIVEKIT_API_SECRET")
        }
    }
    path = BASE / "livekit" / "livekit.yaml"
    with open(path, "w") as f:
        yaml.dump(config, f, default_flow_style=False)
    print(f"Generated: {path}")

def generate_nginx_conf():
    public = BASE / "frontend" / "dist"

    config = f"""worker_processes 1;

events {{}}

http {{
    include     mime.types;

    access_log  logs/access.log;
    error_log   logs/error.log warn;

    upstream backend {{
        server 127.0.0.1:5000;
    }}

    server {{
        listen       8080;

        root    "{public.as_posix()}";
        index   index.html;

        location / {{
            try_files $uri $uri/ /index.html;
        }}

        location = / {{
            allow 127.0.0.1;
            deny all;
            try_files $uri $uri/ /index.html;
        }}

        location /config {{
            proxy_pass http://backend;
        }}

        location /token {{
            proxy_pass http://backend;
            proxy_set_header X-Real-IP $remote_addr;
        }}
        
        location /participants {{
            proxy_pass http://backend;
        }}

        location /logs {{
            proxy_pass http://backend;
        }}

        location /room-config {{
            proxy_pass http://backend;
        }}

        location /rooms {{
            proxy_pass http://backend;
        }}
    }}
}}
"""
    path = BASE / "nginx" / "conf" / "nginx.conf"
    with open(path, "w") as f:
        f.write(config)
    print(f"Generated: {path}")

def main():
    local_ip = get_local_ip()
    print(f"Detected IP: {local_ip}")
    generate_livekit_yaml(local_ip)
    generate_nginx_conf()

if __name__ == "__main__":
    main()
