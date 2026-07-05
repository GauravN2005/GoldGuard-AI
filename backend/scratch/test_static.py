import httpx

try:
    # Test GET request to the static file report URL
    url = "http://127.0.0.1:8000/static/uploads/reports/INS-272B2D27_report.pdf"
    print("Testing GET request to:", url)
    res = httpx.get(url)
    print("Response status code:", res.status_code)
    print("Response text:", res.text)
    print("Response headers:", dict(res.headers))
    print("Content length:", len(res.content))
except Exception as e:
    print("Static request failed:", str(e))
