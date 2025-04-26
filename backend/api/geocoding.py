import time
import logging
from functools import wraps

logger = logging.getLogger(__name__)

class GeocodingRateLimiter:
    def __init__(self, max_calls_per_second=10):
        self.max_calls_per_second = max_calls_per_second
        self.calls = []
        
    def wait_if_needed(self):
        """Wait if we've made too many calls in the last second"""
        now = time.time()
        
        # Remove calls older than 1 second
        self.calls = [call_time for call_time in self.calls if now - call_time < 1.0]
        
        # If we've made too many calls, wait
        if len(self.calls) >= self.max_calls_per_second:
            sleep_time = 1.0 - (now - self.calls[0])
            if sleep_time > 0:
                logger.debug(f"Rate limiting: sleeping for {sleep_time:.2f} seconds")
                time.sleep(sleep_time)
            
        # Add the current call
        self.calls.append(time.time())

# Global rate limiter instance
rate_limiter = GeocodingRateLimiter()

def rate_limited(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        rate_limiter.wait_if_needed()
        return func(*args, **kwargs)
    return wrapper