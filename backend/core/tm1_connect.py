import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

class TM1Connect:
    _session = None
    _base_url = None
    _session_expiry = 0
    SESSION_TTL = 600  # 10 minutes

    @classmethod
    def get_session(cls):
        """Return authenticated session - re-authenticates when needed"""
        current_time = time.time()

        if cls._session is None or current_time > cls._session_expiry:
            cfg = {
                'address': os.getenv('TM1_ADDRESS'),
                'port': os.getenv('TM1_PORT'),
                'client_id': os.getenv('TM1_CLIENT_ID'),
                'client_secret': os.getenv('TM1_CLIENT_SECRET'),
                'user': os.getenv('TM1_USER'),
            }

            base = f"http://{cfg['address']}:{cfg['port']}/tm1"

            # Authenticate using the same method as your governance project
            auth_response = requests.post(
                f"{base}/auth/v1/session",
                auth=(cfg['client_id'], cfg['client_secret']),
                headers={'Content-Type': 'application/json'},
                json={'User': cfg['user']},
                timeout=15
            )
            auth_response.raise_for_status()

            token = auth_response.cookies.get('TM1SessionId')

            cls._session = requests.Session()
            cls._session.cookies.set('TM1SessionId', token)
            cls._session.headers.update({'Content-Type': 'application/json'})
            cls._base_url = f"{base}/api/v1/Databases('TM1 Governance')"

            cls._session_expiry = current_time + cls.SESSION_TTL
            print("✅ TM1 session established successfully using Client Credentials")

        return cls._session

    @classmethod
    def get_base_url(cls):
        if cls._base_url is None:
            cls.get_session()
        return cls._base_url

tm1_connect = TM1Connect()
