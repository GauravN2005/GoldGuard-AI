import os, sys, asyncio, json
os.environ['MPLCONFIGDIR'] = r'D:\goldguard-ai-portal\backend\.matplotlib'
sys.path.insert(0, r'D:\goldguard-ai-portal\backend')

from app.core.database import AsyncSessionLocal
from app.models.inspection import Inspection
from app.models.additional_models import AIPrediction, InspectionResult
from sqlalchemy import select

async def verify_db():
    async with AsyncSessionLocal() as db:
        insp_res = await db.execute(select(Inspection).where(Inspection.id == 'INS-009406F5'))
        insp = insp_res.scalar_one_or_none()
        if insp:
            print('=== INSPECTION RECORD ===')
            print(f'  id              : {insp.id}')
            print(f'  status          : {insp.status}')
            auth = insp.authenticity_score
            risk = insp.risk_score
            conf = insp.confidence
            fac = insp.factors
            imgs = list((insp.images or {}).keys())
            print(f'  authenticity    : {auth}%')
            print(f'  risk_score      : {risk}%')
            print(f'  confidence      : {conf}%')
            print(f'  factors         : {fac}')
            print(f'  images keys     : {imgs}')
        else:
            print('  Inspection INS-009406F5 not found in DB')

        print()
        print('=== INSPECTION RESULT TABLE ===')
        ir_res = await db.execute(select(InspectionResult).where(InspectionResult.inspection_id == 'INS-009406F5'))
        rows = ir_res.scalars().all()
        print(f'  rows found: {len(rows)}')
        for ir in rows:
            print(f'  density_score   : {ir.density_score}')
            print(f'  surface_score   : {ir.surface_score}')
            print(f'  reflection_score: {ir.reflection_score}')
            print(f'  touchstone_score: {ir.touchstone_score}')
            print(f'  visual_score    : {ir.visual_score}')
            print(f'  overall_score   : {ir.overall_score}')

        print()
        print('=== AI PREDICTION TABLE ===')
        pred_res = await db.execute(select(AIPrediction).where(AIPrediction.inspection_id == 'INS-009406F5'))
        preds = pred_res.scalars().all()
        print(f'  prediction records found: {len(preds)}')
        if preds:
            latest = preds[-1]
            pd_data = latest.prediction_data or {}
            auth2 = pd_data.get('authenticity_score')
            risk2 = pd_data.get('overall_risk')
            rec = pd_data.get('recommendation')
            proc = pd_data.get('processing_time_ms')
            print(f'  authenticity_score : {auth2}')
            print(f'  overall_risk       : {risk2}')
            print(f'  recommendation     : {rec}')
            print(f'  processing_time_ms : {proc}')
            mr = pd_data.get('model_runs', {})
            if mr:
                print('  model_runs persisted:')
                for model_key, data in mr.items():
                    p = data.get('prediction')
                    c = data.get('confidence')
                    m = data.get('model_name')
                    t = data.get('processing_time_ms')
                    print(f'    {model_key}: pred={p}, conf={c}, model={m}, time={t}ms')
            else:
                print('  model_runs key NOT present (pre-integration record, will be populated on next scan)')

asyncio.run(verify_db())
