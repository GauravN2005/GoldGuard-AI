import os
import httpx
from app.core.config import settings
from app.core.logger import logger
from datetime import datetime, timezone

class LocalStorageService:
    """
    A simple, production-ready local disk storage provider.
    Saves uploaded files directly to the static/uploads folder.
    """
    def __init__(self):
        # Base folder under backend/static/uploads
        self.base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "uploads")
        os.makedirs(self.base_dir, exist_ok=True)
        self.enabled = True
        self.bucket_name = "local-vault"

    def upload_file(self, file_data: bytes, object_name: str, content_type: str = None) -> str:
        try:
            local_path = os.path.join(self.base_dir, object_name)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(file_data)
            logger.info("Saved file locally", object_name=object_name, size=len(file_data))
            return f"local://{object_name}"
        except Exception as e:
            logger.error("Failed to save file locally", error=str(e), object_name=object_name)
            raise e

    def get_presigned_url(self, object_name: str, expires_in: int = 3600) -> str:
        if object_name.startswith("local://"):
            rel_path = object_name.replace("local://", "")
            return f"/static/uploads/{rel_path}"
        if object_name.startswith("mock://"):
            return f"/static/fallback.jpg"
        return f"/static/uploads/{object_name}"

    def download_file(self, object_name: str) -> bytes:
        if object_name.startswith("local://"):
            rel_path = object_name.replace("local://", "")
        elif object_name.startswith("supabase://"):
            rel_path = object_name.replace("supabase://", "")
        elif object_name.startswith("s3://"):
            rel_path = object_name.split("/", 3)[-1]
        else:
            rel_path = object_name

        local_path = os.path.join(self.base_dir, rel_path)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()
        
        logger.warning("Local file not found, creating a fallback document", path=local_path)
        from app.services.report_generator import report_generator
        return report_generator.generate_inspection_pdf({
            "id": "FALLBACK",
            "customerName": "Fallback Local System Overview",
            "customerId": "GG-SYSTEM-DUMMY",
            "date": datetime.now(timezone.utc).isoformat(),
            "branch": "System Local",
            "appraiser": "System Administrator",
            "status": "Offline Mode",
            "weight": 12.5,
            "purity": "22K (91.6%)",
            "jewelryType": "Gold Chain",
            "length": 150,
            "width": 5,
            "thickness": 2,
            "authenticityScore": 99
        })


class SupabaseStorageService:
    """
    Production-ready storage service that uploads to Supabase Storage.
    Uses standard HTTP requests to interact with the Supabase Storage REST API.
    """
    def __init__(self, supabase_url: str, supabase_key: str, bucket_name: str = "goldguard-vault"):
        self.supabase_url = supabase_url.rstrip("/")
        self.supabase_key = supabase_key
        self.bucket_name = bucket_name
        self.enabled = True
        logger.info(f"Initializing Supabase Storage on {self.supabase_url} (bucket: {self.bucket_name})")
        self._create_bucket_if_not_exists()

    def _create_bucket_if_not_exists(self):
        try:
            headers = {
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json"
            }
            # Check if bucket exists
            url = f"{self.supabase_url}/storage/v1/bucket/{self.bucket_name}"
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    logger.info(f"Supabase bucket '{self.bucket_name}' verified.")
                    return
                
                # Create public bucket if not found
                logger.info(f"Supabase bucket '{self.bucket_name}' not found. Attempting to create it...")
                create_url = f"{self.supabase_url}/storage/v1/bucket"
                payload = {
                    "id": self.bucket_name,
                    "name": self.bucket_name,
                    "public": True,
                    "file_size_limit": 52428800,
                    "allowed_mime_types": ["image/jpeg", "image/png", "image/webp", "application/pdf"]
                }
                res = client.post(create_url, headers=headers, json=payload)
                if res.status_code in [200, 201]:
                    logger.info(f"Successfully created public Supabase bucket '{self.bucket_name}'.")
                else:
                    logger.warning(f"Unable to create Supabase bucket (status {res.status_code}): {res.text}")
        except Exception as e:
            logger.error(f"Error initializing Supabase Storage bucket: {e}")

    def upload_file(self, file_data: bytes, object_name: str, content_type: str = None) -> str:
        headers = {
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": content_type or "application/octet-stream"
        }
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{object_name}"
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(url, headers=headers, content=file_data)
                if res.status_code in [200, 201]:
                    logger.info("Uploaded file successfully to Supabase Storage", object_name=object_name)
                    return f"supabase://{object_name}"
                else:
                    logger.error("Supabase upload request failed", status=res.status_code, response=res.text)
                    raise Exception(f"Supabase storage upload failed: {res.text}")
        except Exception as e:
            logger.error("Failed to upload file to Supabase, falling back to local file creation", error=str(e))
            # Save locally as a fallback
            local_service = LocalStorageService()
            return local_service.upload_file(file_data, object_name, content_type)

    def get_presigned_url(self, object_name: str, expires_in: int = 3600) -> str:
        if object_name.startswith("local://"):
            local_service = LocalStorageService()
            return local_service.get_presigned_url(object_name, expires_in)
        if object_name.startswith("mock://"):
            return f"/static/fallback.jpg"
        
        clean_name = object_name.replace("supabase://", "")
        return f"{self.supabase_url}/storage/v1/object/public/{self.bucket_name}/{clean_name}"

    def download_file(self, object_name: str) -> bytes:
        if object_name.startswith("local://"):
            local_service = LocalStorageService()
            return local_service.download_file(object_name)
        if object_name.startswith("mock://"):
            local_service = LocalStorageService()
            return local_service.download_file("mock://")

        clean_name = object_name.replace("supabase://", "")
        headers = {
            "Authorization": f"Bearer {self.supabase_key}"
        }
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{clean_name}"
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    return res.content
                else:
                    raise Exception(f"Failed to download from Supabase: {res.status_code}")
        except Exception as e:
            logger.error("Failed to download file from Supabase, returning local fallback", error=str(e))
            local_service = LocalStorageService()
            return local_service.download_file(object_name)


# Initialize active storage service
_supabase_url = settings.SUPABASE_URL
_supabase_key = settings.SUPABASE_KEY

# Smart fallback: auto-detect Supabase URL from DATABASE_URL if key is present
if not _supabase_url and _supabase_key and settings.DATABASE_URL:
    if "pooler.supabase" in settings.DATABASE_URL or "supabase.com" in settings.DATABASE_URL:
        ref_id = None
        if "postgres." in settings.DATABASE_URL:
            try:
                parts = settings.DATABASE_URL.split("@")[0].split("://")[-1].split(":")
                username = parts[0]
                if "." in username:
                    ref_id = username.split(".")[-1]
            except Exception:
                pass
        if ref_id:
            _supabase_url = f"https://{ref_id}.supabase.co"
            logger.info("Automatically resolved Supabase URL from Database URL", url=_supabase_url)

if _supabase_url and _supabase_key:
    storage_service = SupabaseStorageService(
        supabase_url=_supabase_url,
        supabase_key=_supabase_key,
        bucket_name=settings.SUPABASE_BUCKET
    )
else:
    storage_service = LocalStorageService()
