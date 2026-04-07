from tm1py import TM1Service
from tm1py.exceptions import TM1pyRestException
import os
from dotenv import load_dotenv
from typing import Optional
import time

load_dotenv()

class TM1Client:
    def __init__(self):
        self._tm1: Optional[TM1Service] = None
        self._last_used = 0
        self.session_ttl = 300  # 5 minutes

    def get_connection(self):
        """Get TM1 connection - simple version for now"""
        current_time = time.time()
        
        if self._tm1 and (current_time - self._last_used < self.session_ttl):
            self._last_used = current_time
            return self._tm1

        try:
            self._tm1 = TM1Service(
                address=os.getenv("TM1_ADDRESS", "localhost"),
                port=int(os.getenv("TM1_PORT", "8001")),
                user=os.getenv("TM1_USER"),
                password=os.getenv("TM1_PASSWORD"),
                ssl=os.getenv("TM1_SSL", "False").lower() == "true",
                namespace=os.getenv("TM1_NAMESPACE")
            )
            self._last_used = current_time
            print("✅ Successfully connected to TM1")
            return self._tm1
        except Exception as e:
            print(f"❌ TM1 connection failed: {e}")
            raise

# Global instance
tm1_client = TM1Client()
