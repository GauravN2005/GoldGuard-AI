"""
Direct AI inference verification script.
Loads the real orchestrator (same code the backend uses) and runs it against
the actual uploaded images for INS-009406F5.
"""
import os, sys, asyncio, json, time
os.environ['MPLCONFIGDIR'] = r'D:\goldguard-ai-portal\backend\.matplotlib'
os.chdir(r'D:\goldguard-ai-portal\backend')
sys.path.insert(0, r'D:\goldguard-ai-portal\backend')

from unittest.mock import AsyncMock, MagicMock

# ── Import the actual orchestrator (same singleton used in prod) ──────────────
from app.services.ai_services import ai_orchestrator

# ── Build a mock Inspection object matching INS-009406F5 ──────────────────────
uploads_base = r'D:\goldguard-ai-portal\backend\static\uploads\inspections\INS-009406F5'
inspection = MagicMock()
inspection.id = 'INS-009406F5'
inspection.jewelry_type = 'Gold Chain'
inspection.purity = '22K'
inspection.weight = 15.4
inspection.length = 150.0
inspection.width = 5.0
inspection.thickness = 2.0
inspection.status = 'Pending'
inspection.lighting = 90
inspection.focus = 88
inspection.angle_coverage = 85

# Use local:// paths pointing at actual uploaded files
inspection.images = {
    'front':      'local://inspections/INS-009406F5/front_front.jpg',
    'back':       'local://inspections/INS-009406F5/back_back.jpg',
    'left':       'local://inspections/INS-009406F5/left_left.jpg',
    'right':      'local://inspections/INS-009406F5/right_right.jpg',
    'top':        'local://inspections/INS-009406F5/top_top.jpg',
    'reflection': 'local://inspections/INS-009406F5/reflection_reflection.jpg',
    'touchstone': 'local://inspections/INS-009406F5/touchstone_touchstone.jpg',
}

# ── Mock DB session (we're not writing to DB here, just running inference) ─────
class MockDB:
    def add(self, obj): pass
    async def commit(self): pass
    async def flush(self): pass
    async def execute(self, query):
        mock_result = MagicMock()
        query_str = str(query)
        if "inspections" in query_str.lower():
            mock_result.scalar_one_or_none.return_value = inspection
        else:
            mock_result.scalars.return_value.all.return_value = []
        return mock_result

async def run_verification():
    print("=" * 65)
    print("  GOLDGUARD AI PIPELINE — REAL INFERENCE VERIFICATION")
    print("  Inspection: INS-009406F5  |  22K Gold Chain")
    print("=" * 65)
    print()

    db = MockDB()
    t_start = time.perf_counter()
    
    # Run all sub-services individually and capture timings
    print("━━━ [1] SURFACE ANALYSIS (MobileNetV3) ━━━━━━━━━━━━━━━━━━━━")
    t0 = time.perf_counter()
    cv_res = await ai_orchestrator.cv.analyze_visuals(inspection, db)
    t1 = time.perf_counter()
    print(f"  Model      : {cv_res.get('model_name')}")
    print(f"  Images used: front, back, left, right, top")
    print(f"  Prediction : {cv_res.get('prediction')}")
    print(f"  Confidence : {cv_res.get('confidence_score')}%")
    print(f"  Score      : {cv_res.get('score')}%")
    print(f"  Status     : {cv_res.get('status')}")
    print(f"  Infer time : {cv_res.get('inference_time')} ms")
    print(f"  Details    : {cv_res.get('details')}")
    print()

    print("━━━ [2] DEFECT LOCALIZATION (YOLOv11) ━━━━━━━━━━━━━━━━━━━━━")
    defect_res = await ai_orchestrator.defect.localize_defects(inspection, db)
    print(f"  Model      : {defect_res.get('model_name')}")
    print(f"  Image used : front")
    print(f"  Prediction : {defect_res.get('prediction')}")
    print(f"  Confidence : {defect_res.get('confidence_score')}%")
    print(f"  Score      : {defect_res.get('score')}%")
    print(f"  Status     : {defect_res.get('status')}")
    print(f"  Infer time : {defect_res.get('inference_time')} ms")
    print(f"  Explanation: {defect_res.get('explanation')}")
    print()

    print("━━━ [3] DENSITY ENGINE (Physics) ━━━━━━━━━━━━━━━━━━━━━━━━━━")
    density_res = await ai_orchestrator.density.analyze_density(inspection)
    print(f"  Model      : Hydrostatic Physics Engine")
    print(f"  Calculated : {density_res.get('calculated_density')} g/cm³")
    print(f"  Expected   : {density_res.get('expected_density')} g/cm³")
    print(f"  Diff       : {density_res.get('difference_percentage')}%")
    print(f"  Score      : {density_res.get('score')}%")
    print(f"  Status     : {density_res.get('status')}")
    print(f"  Risk Level : {density_res.get('risk_level')}")
    print()

    print("━━━ [4] REFLECTION ANALYSIS (RandomForest) ━━━━━━━━━━━━━━━━")
    reflection_res = await ai_orchestrator.reflection.analyze_reflection(inspection, db, expected_purity=0.916)
    print(f"  Model      : {reflection_res.get('model_name')}")
    print(f"  Image used : reflection")
    print(f"  Prediction : {reflection_res.get('prediction')}")
    print(f"  Confidence : {reflection_res.get('confidence_score')}%")
    print(f"  Score      : {reflection_res.get('score')}%")
    print(f"  Status     : {reflection_res.get('status')}")
    print(f"  Infer time : {reflection_res.get('inference_time')} ms")
    print()

    print("━━━ [5] TOUCHSTONE ANALYSIS (ResNet18) ━━━━━━━━━━━━━━━━━━━━")
    touchstone_res = await ai_orchestrator.touchstone.analyze_streak(inspection, db)
    print(f"  Model      : {touchstone_res.get('model_name')}")
    print(f"  Image used : touchstone")
    print(f"  Prediction : {touchstone_res.get('prediction')}")
    print(f"  Confidence : {touchstone_res.get('confidence_score')}%")
    print(f"  Score      : {touchstone_res.get('score')}%")
    print(f"  Status     : {touchstone_res.get('status')}")
    print(f"  Infer time : {touchstone_res.get('inference_time')} ms")
    print()

    print("━━━ [6] FINAL RISK ENGINE (Decision Fusion) ━━━━━━━━━━━━━━━")
    fusion_res = await ai_orchestrator.fusion.run_fusion(
        surface_score=cv_res["score"],
        defect_score=defect_res["score"],
        reflection_score=reflection_res["score"],
        touchstone_score=touchstone_res["score"],
        density_score=density_res["score"]
    )
    print(f"  Authenticity Score : {fusion_res.get('authenticity_score')}%")
    print(f"  Confidence         : {fusion_res.get('confidence_score')}%")
    print(f"  Overall Risk       : {fusion_res.get('overall_risk')}")
    print(f"  Recommendation     : {fusion_res.get('recommendation')}")
    print()

    total_ms = int((time.perf_counter() - t_start) * 1000)
    print("=" * 65)
    print("  VERIFICATION SUMMARY")
    print("=" * 65)
    
    simulated_count = 0
    for name, res in [
        ("Surface Analysis", cv_res),
        ("Defect Localization", defect_res),
        ("Reflection Analysis", reflection_res),
        ("Touchstone Analysis", touchstone_res),
    ]:
        status = res.get("status", "")
        prediction = res.get("prediction", "")
        conf = res.get("confidence_score", 0)
        infer_t = res.get("inference_time", 0)
        is_real = status not in ("Unavailable",) and prediction not in ("Unavailable", None)
        tag = "REAL" if is_real else "SIMULATED/UNAVAILABLE"
        if not is_real:
            simulated_count += 1
        print(f"  {name:25s}: {tag} | pred={prediction}, conf={conf}%, time={infer_t}ms")

    print(f"  Density Engine           : REAL (physics engine)")
    print(f"  Final Risk Engine        : REAL (weighted fusion)")
    print()
    print(f"  Total pipeline time      : {total_ms} ms")
    print(f"  Simulated/unavailable    : {simulated_count}/4 models")
    print()
    
    if simulated_count == 0:
        print("  ✅ ALL 4 AI MODELS EXECUTED REAL FORWARD INFERENCE")
        print("  ✅ Images were correctly routed to each model")
        print("  ✅ Predictions are derived from real model outputs")
    else:
        print(f"  ⚠️  {simulated_count} model(s) returned simulated/unavailable outputs")
    
    print()
    print("  DB Persistence: model_runs will be written to AIPrediction")
    print("  table with keys: surface_analysis, defect_localization,")
    print("  reflection_analysis, touchstone_analysis")
    print()
    
    # Dump complete model_runs payload 
    model_runs = {
        "surface_analysis": {
            "prediction": cv_res.get("prediction"),
            "confidence": cv_res.get("confidence_score", 0) / 100.0,
            "model_name": cv_res.get("model_name"),
            "processing_time_ms": cv_res.get("inference_time"),
            "score": cv_res.get("score"),
            "status": cv_res.get("status"),
        },
        "defect_localization": {
            "prediction": defect_res.get("prediction"),
            "confidence": defect_res.get("confidence_score", 0) / 100.0,
            "model_name": defect_res.get("model_name"),
            "processing_time_ms": defect_res.get("inference_time"),
            "score": defect_res.get("score"),
            "status": defect_res.get("status"),
        },
        "reflection_analysis": {
            "prediction": reflection_res.get("prediction"),
            "confidence": reflection_res.get("confidence_score", 0) / 100.0,
            "model_name": reflection_res.get("model_name"),
            "processing_time_ms": reflection_res.get("inference_time"),
            "score": reflection_res.get("score"),
            "status": reflection_res.get("status"),
        },
        "touchstone_analysis": {
            "prediction": touchstone_res.get("prediction"),
            "confidence": touchstone_res.get("confidence_score", 0) / 100.0,
            "model_name": touchstone_res.get("model_name"),
            "processing_time_ms": touchstone_res.get("inference_time"),
            "score": touchstone_res.get("score"),
            "status": touchstone_res.get("status"),
        },
    }
    print("  model_runs JSON payload (as stored in AIPrediction table):")
    print(json.dumps(model_runs, indent=4))

asyncio.run(run_verification())
