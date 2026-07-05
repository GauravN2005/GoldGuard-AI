import sys
sys.path.insert(0, r'D:\goldguard-ai-portal\backend')

from app.services.report_generator import report_generator

try:
    rep_data = {
        "id": "INS-TEST",
        "customerName": "Test Customer",
        "customerId": "CUST-1",
        "date": "2026-07-06T00:00:00",
        "branch": "Test Branch",
        "appraiser": "Test Appraiser",
        "status": "Verified",
        "weight": 10.0,
        "purity": "22K",
        "jewelryType": "Gold Ring",
        "length": 15.0,
        "width": 15.0,
        "thickness": 2.0,
        "authenticityScore": 95,
        "notes": "Test remarks",
        "factors": {"density": 95, "surface": 90, "reflection": 95, "touchstone": 95, "visualDefect": 90},
        "llm_narrative": {
            "executive_summary": "Test summary",
            "risk_assessment": "Test risk",
            "recommendation_details": "Test recommendation",
            "conclusion": "Test conclusion"
        }
    }
    pdf_bytes = report_generator.generate_inspection_pdf(rep_data)
    print("PDF generated successfully! Bytes length:", len(pdf_bytes))
except Exception as e:
    import traceback
    print("PDF Generation Failed!")
    traceback.print_exc()
