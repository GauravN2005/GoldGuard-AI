from fpdf import FPDF
from app.core.logger import logger
from datetime import datetime
from typing import Any


class ReportGenerator:
    def sanitize_text(self, text: Any) -> str:
        if text is None:
            return ""
        s_text = str(text)
        # Replace common non-latin-1 characters to avoid FPDFUnicodeEncodingException
        replacements = {
            "\u2014": "-",  # em-dash
            "\u2013": "-",  # en-dash
            "\u201c": '"',  # smart open double quote
            "\u201d": '"',  # smart close double quote
            "\u2018": "'",  # smart open single quote
            "\u2019": "'",  # smart close single quote
            "\u2022": "*",  # bullet point
            "\u20b9": "INR",  # Rupee symbol
        }
        for orig, rep in replacements.items():
            s_text = s_text.replace(orig, rep)
        # Fallback to ascii/latin-1 approximation, drop unsupported characters
        return s_text.encode("latin-1", errors="replace").decode("latin-1")

    def generate_inspection_pdf(self, inspection_data: dict) -> bytes:
        logger.info("Generating PDF report document via FPDF", inspection_id=inspection_data.get("id"))
        
        pdf = FPDF()
        pdf.add_page()
        
        # GoldGuard Brand Header
        pdf.set_fill_color(212, 175, 55) # #d4af37 (Gold)
        pdf.rect(0, 0, 210, 40, "F")
        
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("helvetica", "B", 24)
        pdf.cell(0, 15, "GOLDGUARD AI", ln=True, align="C")
        pdf.set_font("helvetica", "I", 12)
        pdf.cell(0, 10, "Gold Loan Jewelry Verification Report", ln=True, align="C")
        pdf.ln(10)
        
        # Reset colors for body
        pdf.set_text_color(26, 26, 26)
        
        # Metadata block
        pdf.set_font("helvetica", "B", 14)
        pdf.cell(0, 10, self.sanitize_text(f"Verification Summary - {inspection_data.get('id')}"), ln=True)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)
        
        pdf.set_font("helvetica", "", 11)
        pdf.cell(100, 8, self.sanitize_text(f"Customer Name: {inspection_data.get('customerName')}"), ln=False)
        pdf.cell(0, 8, self.sanitize_text(f"Customer ID: {inspection_data.get('customerId')}"), ln=True)
        
        date_val = inspection_data.get('date') or ""
        date_str = date_val[:16] if date_val else ""
        pdf.cell(100, 8, self.sanitize_text(f"Date: {date_str}"), ln=False)
        pdf.cell(0, 8, self.sanitize_text(f"Branch Location: {inspection_data.get('branch')}"), ln=True)
        
        pdf.cell(100, 8, self.sanitize_text(f"Appraiser Initiator: {inspection_data.get('appraiser')}"), ln=False)
        pdf.cell(0, 8, self.sanitize_text(f"Status Category: {inspection_data.get('status')}"), ln=True)
        pdf.ln(5)
        
        # Asset dimensions
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 10, "Physical Specifications", ln=True)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(3)
        
        pdf.set_font("helvetica", "", 11)
        pdf.cell(100, 8, self.sanitize_text(f"Asset Weight: {inspection_data.get('weight')} g"), ln=False)
        pdf.cell(0, 8, self.sanitize_text(f"Gold Purity: {inspection_data.get('purity')}"), ln=True)
        pdf.cell(100, 8, self.sanitize_text(f"Jewelry Type: {inspection_data.get('jewelryType')}"), ln=False)
        pdf.cell(0, 8, self.sanitize_text(f"Dimensions: {inspection_data.get('length')} x {inspection_data.get('width')} x {inspection_data.get('thickness')} mm"), ln=True)
        pdf.ln(5)

        # AI assessment breakdown
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 10, "AI Sensor Diagnostics Matrix", ln=True)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(3)
        
        factors = inspection_data.get("factors", {})
        pdf.set_font("helvetica", "", 11)
        pdf.cell(100, 8, self.sanitize_text(f"Computer Vision surface check: {factors.get('visualDefect', 100)}%"), ln=False)
        pdf.cell(0, 8, self.sanitize_text(f"Hydrostatic volume density check: {factors.get('density', 100)}%"), ln=True)
        
        pdf.cell(100, 8, self.sanitize_text(f"Reflectance analysis checks: {factors.get('reflection', 100)}%"), ln=False)
        pdf.cell(0, 8, self.sanitize_text(f"Streak chemical reactivity check: {factors.get('touchstone', 100)}%"), ln=True)
        pdf.ln(5)
        
        # Summary & decision with dynamic box height calculation and word-wrapping
        raw_notes = inspection_data.get("notes") or "No remarks provided."
        # Strip any markdown headers/styling characters from notes for clean presentation
        clean_notes = raw_notes.replace("**", "").replace("###", "").replace("#", "")
        notes_text = self.sanitize_text(f"Notes:\n{clean_notes}")
        
        # Estimate text line wrapping (A4 width 186mm fits ~90 chars in Helvetica 10pt)
        text_lines = 0
        for line in notes_text.splitlines():
            text_lines += max(1, len(line) // 90 + 1)
            
        box_height = 14 + (text_lines * 5.2)
        
        pdf.set_fill_color(240, 240, 240)
        pdf.rect(10, pdf.get_y(), 190, box_height, "F")
        pdf.set_y(pdf.get_y() + 2)
        
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 8, self.sanitize_text(f"  Composite Authenticity Score: {inspection_data.get('authenticityScore')}%"), ln=True)
        
        pdf.set_font("helvetica", "", 10)
        pdf.set_x(12)  # align inside grey box padding
        pdf.multi_cell(186, 5.2, notes_text, border=0, align="L")
        pdf.ln(10)
        
        # Sign-off signatures
        pdf.ln(15)
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(100, 5, "Appraiser Signature", ln=False)
        pdf.cell(0, 5, "Audit Officer Check", ln=True)
        pdf.set_font("helvetica", "", 9)
        pdf.cell(100, 5, "_______________________", ln=False)
        pdf.cell(0, 5, "_______________________", ln=True)

        # AI Explainable Analysis & Narrative (LLM Generated)
        llm_narrative = inspection_data.get("llm_narrative")
        if llm_narrative:
            pdf.add_page()
            
            # Subheader
            pdf.set_fill_color(212, 175, 55) # Gold header bar
            pdf.rect(0, 0, 210, 20, "F")
            pdf.set_y(5)
            pdf.set_text_color(255, 255, 255)
            pdf.set_font("helvetica", "B", 14)
            pdf.cell(0, 10, "GOLDGUARD AI - EXPLAINABILITY REPORT", ln=True, align="C")
            pdf.ln(10)
            
            # Reset colors
            pdf.set_text_color(26, 26, 26)
            
            # 1. Executive Summary
            pdf.set_font("helvetica", "B", 12)
            pdf.cell(0, 8, "1. Executive Summary", ln=True)
            pdf.line(10, pdf.get_y(), 200, pdf.get_y())
            pdf.ln(3)
            
            pdf.set_font("helvetica", "", 10)
            exec_summary = llm_narrative.get("executive_summary", "Inspection narrative summary compiled successfully.") if isinstance(llm_narrative, dict) else str(llm_narrative)
            pdf.multi_cell(0, 5, self.sanitize_text(exec_summary))
            pdf.ln(5)
            
            if isinstance(llm_narrative, dict):
                # 2. Risk Assessment
                pdf.set_font("helvetica", "B", 12)
                pdf.cell(0, 8, "2. Forensic Risk Assessment", ln=True)
                pdf.line(10, pdf.get_y(), 200, pdf.get_y())
                pdf.ln(3)
                
                pdf.set_font("helvetica", "", 10)
                pdf.multi_cell(0, 5, self.sanitize_text(llm_narrative.get("risk_assessment", "Standard diagnostic checklist verification completed.")))
                pdf.ln(5)
                
                # 3. Recommendation Details
                pdf.set_font("helvetica", "B", 12)
                pdf.cell(0, 8, "3. Appraisal Decision Context", ln=True)
                pdf.line(10, pdf.get_y(), 200, pdf.get_y())
                pdf.ln(3)
                
                pdf.set_font("helvetica", "", 10)
                pdf.multi_cell(0, 5, self.sanitize_text(llm_narrative.get("recommendation_details", "Loan recommendation processed according to branch thresholds.")))
                pdf.ln(5)
                
                # 4. Conclusion
                pdf.set_font("helvetica", "B", 12)
                pdf.cell(0, 8, "4. Verification Conclusion", ln=True)
                pdf.line(10, pdf.get_y(), 200, pdf.get_y())
                pdf.ln(3)
                
                pdf.set_font("helvetica", "I", 10)
                pdf.multi_cell(0, 5, self.sanitize_text(llm_narrative.get("conclusion", "This collateral item has been verified in compliance with GoldGuard guidelines.")))
                pdf.ln(5)

        return bytes(pdf.output())


report_generator = ReportGenerator()
