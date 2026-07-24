import os
import yaml
from dotenv import load_dotenv
from networking import get_local_ip
from pathlib import Path

load_dotenv("../.env")

BASE = Path(__file__).resolve().parents[1]

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
    public = BASE / "public"
    view_html = public / "view.html"

    config = f"""worker_processes 1;

events {{}}

http {{
    include     mime.types;

    access_log  logs/access.log;
    error_log   logs/error.log debug;

    server {{
        listen       8080;

        location / {{
            root   {public};
            index  present.html;
            try_files $uri $uri/ =404;
        }}

        location = / {{
            allow 127.0.0.1;
            deny all;
            root   {public};
            index  present.html;
            try_files $uri $uri/ =404;
        }}

        location = /view {{
            alias   {view_html};
            add_header Content-Type text/html;
        }}

        location = /present.html {{
            allow 127.0.0.1;
            deny all;
            root {public};
        }}

        location /config {{
            proxy_pass http://127.0.0.1:5000;
        }}

        location /token {{
            proxy_pass http://127.0.0.1:5000;
            proxy_set_header X-Real-IP $remote_addr;
        }}
        
        location /participants {{
            proxy_pass http://127.0.0.1:5000;
        }}
    }}
}}
"""
    path = BASE / "nginx" / "conf" / "nginx.conf"
    with open(path, "w") as f:
        f.write(config)
    print(f"Generated: {path}")

if __name__ == "__main__":
    local_ip = get_local_ip()
    print(f"Detected IP: {local_ip}")
    generate_livekit_yaml(local_ip)
    generate_nginx_conf()