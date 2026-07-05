import urllib.request, json

# Login first
login_data = json.dumps({'email':'admin@goldguardai.com','password':'SecurePass123!'}).encode()
req = urllib.request.Request(
    'http://localhost:8000/api/v1/auth/login',
    data=login_data,
    headers={'Content-Type': 'application/json'}
)
resp = urllib.request.urlopen(req, timeout=5)
token = json.loads(resp.read())['access_token']
print('Token obtained:', token[:30] + '...')

headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}

# Get the inspection record
req2 = urllib.request.Request('http://localhost:8000/api/v1/inspections/INS-009406F5', headers=headers)
resp2 = urllib.request.urlopen(req2, timeout=5)
insp = json.loads(resp2.read())

print()
print('=== INSPECTION API RESPONSE ===')
print('  id             :', insp.get('id'))
print('  status         :', insp.get('status'))
print('  authenticity   :', str(insp.get('authenticity_score')) + '%')
print('  risk_score     :', str(insp.get('risk_score')) + '%')
print('  confidence     :', str(insp.get('confidence')) + '%')
print('  factors        :', insp.get('factors'))
img_keys = list((insp.get('images') or {}).keys())
print('  images stored  :', img_keys)

print()
print('=== AI ANALYSIS RESULTS ===')
ai_res = insp.get('ai_result') or {}
print('  ai_result keys:', list(ai_res.keys()))
if ai_res:
    model_runs = ai_res.get('model_runs', {})
    print('  model_runs persisted:', list(model_runs.keys()))
    for k, v in model_runs.items():
        print('    ' + k + ': pred=' + str(v.get('prediction')) + ', conf=' + str(v.get('confidence')) + ', model=' + str(v.get('model_name')))
else:
    print('  No ai_result in inspection response')

# Try the AI analyze endpoint result from DB
req3 = urllib.request.Request('http://localhost:8000/api/v1/ai/analyze/INS-009406F5', headers=headers)
try:
    resp3 = urllib.request.urlopen(req3, timeout=10)
    ai_data = json.loads(resp3.read())
    print()
    print('=== STORED AI PREDICTION DATA ===')
    print('  authenticity_score:', ai_data.get('authenticity_score'))
    print('  overall_risk      :', ai_data.get('overall_risk'))
    print('  recommendation    :', ai_data.get('recommendation'))
    proc = ai_data.get('processing_time_ms')
    print('  processing_time_ms:', proc)
    mr = ai_data.get('model_runs', {})
    if mr:
        print('  model_runs:')
        for k, v in mr.items():
            print('    ' + k + ': pred=' + str(v.get('prediction')) + ', conf=' + str(v.get('confidence')) + ', model=' + str(v.get('model_name')))
    else:
        print('  model_runs key: MISSING from stored prediction')
except Exception as e:
    print('AI analyze endpoint error:', str(e))
