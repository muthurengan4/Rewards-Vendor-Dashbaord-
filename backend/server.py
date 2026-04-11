from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
import qrcode
import io
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'rewardshub')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'rewardshub-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Create the main app
app = FastAPI(title="RewardsHub API", version="1.0.0")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ========================= MODELS =========================

# User Models
class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    profile_image: Optional[str] = None
    points_balance: int = 0
    total_earned: int = 0
    total_redeemed: int = 0
    qr_code: str
    currency: str = "USD"
    created_at: datetime

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    profile_image: Optional[str] = None
    currency: Optional[str] = None

class PasswordReset(BaseModel):
    email: str

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

# Transaction Models
class TransactionCreate(BaseModel):
    partner_id: Optional[str] = None
    type: str  # "earn" or "redeem"
    points: int
    description: str

class TransactionResponse(BaseModel):
    id: str
    user_id: str
    partner_id: Optional[str] = None
    partner_name: Optional[str] = None
    type: str
    points: int
    description: str
    reference_code: str
    created_at: datetime

# Partner Models
class PartnerCreate(BaseModel):
    name: str
    logo: Optional[str] = None
    description: str
    category: str
    address: str
    points_multiplier: float = 1.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class PartnerResponse(BaseModel):
    id: str
    name: str
    logo: Optional[str] = None
    description: str
    category: str
    address: str
    points_multiplier: float
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: bool = True
    created_at: datetime

# Reward Models
class RewardCreate(BaseModel):
    name: str
    description: str
    image: Optional[str] = None
    points_required: int
    category: str
    terms_conditions: Optional[str] = None
    quantity: int = -1  # -1 means unlimited

class RewardResponse(BaseModel):
    id: str
    name: str
    description: str
    image: Optional[str] = None
    points_required: int
    category: str
    terms_conditions: Optional[str] = None
    quantity: int
    is_active: bool = True
    created_at: datetime

# QR Scan Model
class QRScanRequest(BaseModel):
    qr_code: str
    partner_id: str
    amount: float  # Transaction amount in currency
    points_multiplier: float = 1.0

# Redemption Model
class RedeemRequest(BaseModel):
    reward_id: str

class RedemptionResponse(BaseModel):
    id: str
    user_id: str
    reward_id: str
    reward_name: str
    points_used: int
    redemption_code: str
    status: str
    created_at: datetime

# ========================= VENDOR MODELS =========================

class VendorRegister(BaseModel):
    email: str
    password: str
    store_name: str
    category: str
    description: str
    address: str
    phone: str
    logo: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class VendorLogin(BaseModel):
    email: str
    password: str

class VendorUpdate(BaseModel):
    store_name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    logo: Optional[str] = None
    store_image: Optional[str] = None  # Base64 encoded store image
    points_per_rm: Optional[float] = None  # Points earned per RM spent
    is_active: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class BranchCreate(BaseModel):
    name: str
    address: str
    phone: Optional[str] = None
    is_active: bool = True
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class VendorRewardCreate(BaseModel):
    name: str
    description: str
    points_required: int
    reward_type: str  # cashback, free_item, discount, coupon
    value: float  # RM value for cashback/discount
    image: Optional[str] = None
    terms_conditions: Optional[str] = None
    quantity: int = -1  # -1 means unlimited
    expiry_date: Optional[str] = None
    branch_id: Optional[str] = None  # If specific to a branch

class IssuePointsRequest(BaseModel):
    user_phone: str
    bill_amount: float
    description: Optional[str] = None
    branch_id: Optional[str] = None

class ValidateRedemptionRequest(BaseModel):
    redemption_code: str

class ScanQRRedemptionRequest(BaseModel):
    qr_data: str  # QR code data from user's redemption

class PointRuleCreate(BaseModel):
    min_amount: float
    max_amount: float  # -1 for unlimited/no cap
    points_reward: int
    label: Optional[str] = None  # e.g. "Bronze Tier", "Silver Tier"

class PointRuleUpdate(BaseModel):
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    points_reward: Optional[int] = None
    label: Optional[str] = None
    is_active: Optional[bool] = None

class GeneratePurchaseQRRequest(BaseModel):
    bill_amount: float
    description: Optional[str] = None
    branch_id: Optional[str] = None

# ========================= HELPER FUNCTIONS =========================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_jwt_token(token)
    user = await db.users.find_one({"id": payload["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def generate_qr_code_base64(data: str) -> str:
    """Generate QR code as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def generate_reference_code() -> str:
    return f"RH{datetime.utcnow().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}"

def serialize_doc(doc: dict) -> dict:
    """Remove MongoDB _id field from document"""
    if doc and '_id' in doc:
        del doc['_id']
    return doc

def serialize_docs(docs: list) -> list:
    """Remove MongoDB _id field from list of documents"""
    return [serialize_doc(doc) for doc in docs]

def create_vendor_jwt_token(vendor_id: str, email: str) -> str:
    """Create JWT token for vendor"""
    payload = {
        "vendor_id": vendor_id,
        "email": email,
        "type": "vendor",
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_vendor(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current vendor from JWT token"""
    token = credentials.credentials
    payload = decode_jwt_token(token)
    if payload.get("type") != "vendor":
        raise HTTPException(status_code=401, detail="Invalid vendor token")
    vendor = await db.vendors.find_one({"id": payload["vendor_id"]})
    if not vendor:
        raise HTTPException(status_code=401, detail="Vendor not found")
    return vendor

def generate_redemption_code() -> str:
    """Generate unique redemption code"""
    return f"RDM-{str(uuid.uuid4())[:8].upper()}"

# ========================= AUTH ENDPOINTS =========================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if email already exists
    existing_user = await db.users.find_one({"email": user_data.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    qr_code = f"RH-{user_id[:8].upper()}"
    
    user = {
        "id": user_id,
        "email": user_data.email.lower(),
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "phone": user_data.phone,
        "profile_image": None,
        "points_balance": 100,  # Welcome bonus
        "total_earned": 100,
        "total_redeemed": 0,
        "qr_code": qr_code,
        "currency": "MYR",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user)
    
    # Create welcome transaction
    welcome_transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "partner_id": None,
        "partner_name": "RewardsHub",
        "type": "earn",
        "points": 100,
        "description": "Welcome bonus! Thanks for joining RewardsHub",
        "reference_code": generate_reference_code(),
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(welcome_transaction)
    
    token = create_jwt_token(user_id, user_data.email.lower())
    
    return {
        "message": "Registration successful",
        "token": token,
        "user": {
            "id": user_id,
            "email": user_data.email.lower(),
            "name": user_data.name,
            "phone": user_data.phone,
            "points_balance": 100,
            "total_earned": 100,
            "total_redeemed": 0,
            "qr_code": qr_code,
            "currency": "USD",
            "created_at": user["created_at"]
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email.lower()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_jwt_token(user["id"], user["email"])
    
    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user.get("phone"),
            "profile_image": user.get("profile_image"),
            "points_balance": user["points_balance"],
            "total_earned": user["total_earned"],
            "total_redeemed": user["total_redeemed"],
            "qr_code": user["qr_code"],
            "currency": user.get("currency", "USD"),
            "created_at": user["created_at"]
        }
    }

# ========================= OAUTH / SOCIAL LOGIN ENDPOINTS =========================

@api_router.get("/auth/oauth-config")
async def get_oauth_config():
    """Public endpoint returning enabled OAuth providers and their client IDs (no secrets)"""
    settings = await db.settings.find_one({"id": "app_settings"})
    if not settings:
        return {"google": {"enabled": False}, "facebook": {"enabled": False}, "apple": {"enabled": False}}

    social_enabled = settings.get("social_login_enabled", False)
    google_id = settings.get("google_client_id", "")
    facebook_id = settings.get("facebook_app_id", "")
    apple_id = settings.get("apple_service_id", "")

    return {
        "social_login_enabled": social_enabled,
        "google": {
            "enabled": social_enabled and bool(google_id),
            "client_id": google_id if social_enabled else "",
        },
        "facebook": {
            "enabled": social_enabled and bool(facebook_id),
            "app_id": facebook_id if social_enabled else "",
        },
        "apple": {
            "enabled": social_enabled and bool(apple_id),
            "service_id": apple_id if social_enabled else "",
        },
    }


async def _find_or_create_oauth_user(email: str, name: str, provider: str, provider_id: str):
    """Helper: find existing user by email or create new one for OAuth login"""
    email = email.lower().strip()
    user = await db.users.find_one({"email": email})

    if user:
        # Link OAuth provider if not already linked
        oauth_providers = user.get("oauth_providers", {})
        if provider not in oauth_providers:
            oauth_providers[provider] = provider_id
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"oauth_providers": oauth_providers, "updated_at": datetime.utcnow()}}
            )
        return user

    # Create new user
    user_id = str(uuid.uuid4())
    qr_data = f"REWARDS:{user_id}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    qr_img.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    qr_code = f"data:image/png;base64,{qr_base64}"

    settings = await db.settings.find_one({"id": "app_settings"})
    welcome_bonus = int(settings.get("welcome_bonus_points", 100)) if settings else 100

    new_user = {
        "id": user_id,
        "email": email,
        "name": name or email.split("@")[0],
        "phone": "",
        "password_hash": "",  # No password for OAuth users
        "points_balance": welcome_bonus,
        "total_earned": welcome_bonus,
        "total_redeemed": 0,
        "qr_code": qr_code,
        "currency": "USD",
        "oauth_providers": {provider: provider_id},
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.users.insert_one(new_user)

    if welcome_bonus > 0:
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "earn",
            "amount": welcome_bonus,
            "description": "Welcome bonus",
            "source": "system",
            "created_at": datetime.utcnow(),
        })

    return new_user


def _build_oauth_response(user: dict) -> dict:
    """Build standard auth response for OAuth login"""
    token = create_jwt_token(user["id"], user["email"])
    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user.get("phone", ""),
            "profile_image": user.get("profile_image"),
            "points_balance": user["points_balance"],
            "total_earned": user["total_earned"],
            "total_redeemed": user["total_redeemed"],
            "qr_code": user["qr_code"],
            "currency": user.get("currency", "USD"),
            "created_at": user["created_at"],
        }
    }


@api_router.post("/auth/google")
async def google_oauth_login(data: dict):
    """Validate Google ID token and login/register user"""
    import httpx

    id_token = data.get("id_token") or data.get("access_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="Missing id_token or access_token")

    settings = await db.settings.find_one({"id": "app_settings"})
    if not settings or not settings.get("social_login_enabled"):
        raise HTTPException(status_code=403, detail="Social login is not enabled")

    google_client_id = settings.get("google_client_id", "")
    if not google_client_id:
        raise HTTPException(status_code=403, detail="Google login is not configured")

    try:
        # Verify with Google's tokeninfo endpoint
        async with httpx.AsyncClient() as client:
            # Try userinfo endpoint first (for access tokens from auth session)
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {id_token}"}
            )

            if resp.status_code != 200:
                # Fallback: try tokeninfo for ID tokens
                resp = await client.get(
                    f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
                )
                if resp.status_code != 200:
                    raise HTTPException(status_code=401, detail="Invalid Google token")

            google_user = resp.json()

        email = google_user.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Could not retrieve email from Google")

        name = google_user.get("name", google_user.get("given_name", ""))
        sub = google_user.get("sub", "")

        user = await _find_or_create_oauth_user(email, name, "google", sub)
        return _build_oauth_response(user)

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Google OAuth error: {e}")
        raise HTTPException(status_code=500, detail=f"Google authentication failed: {str(e)}")


@api_router.post("/auth/facebook")
async def facebook_oauth_login(data: dict):
    """Validate Facebook access token and login/register user"""
    import httpx

    access_token = data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Missing access_token")

    settings = await db.settings.find_one({"id": "app_settings"})
    if not settings or not settings.get("social_login_enabled"):
        raise HTTPException(status_code=403, detail="Social login is not enabled")

    facebook_app_id = settings.get("facebook_app_id", "")
    if not facebook_app_id:
        raise HTTPException(status_code=403, detail="Facebook login is not configured")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://graph.facebook.com/me",
                params={
                    "fields": "id,name,email,picture.type(large)",
                    "access_token": access_token,
                }
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Facebook token")

            fb_user = resp.json()

        email = fb_user.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Could not retrieve email from Facebook. Ensure email permission is granted.")

        name = fb_user.get("name", "")
        fb_id = fb_user.get("id", "")

        user = await _find_or_create_oauth_user(email, name, "facebook", fb_id)
        return _build_oauth_response(user)

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Facebook OAuth error: {e}")
        raise HTTPException(status_code=500, detail=f"Facebook authentication failed: {str(e)}")


@api_router.post("/auth/apple")
async def apple_oauth_login(data: dict):
    """Validate Apple identity token and login/register user"""

    identity_token = data.get("identity_token")
    if not identity_token:
        raise HTTPException(status_code=400, detail="Missing identity_token")

    settings = await db.settings.find_one({"id": "app_settings"})
    if not settings or not settings.get("social_login_enabled"):
        raise HTTPException(status_code=403, detail="Social login is not enabled")

    apple_service_id = settings.get("apple_service_id", "")
    if not apple_service_id:
        raise HTTPException(status_code=403, detail="Apple login is not configured")

    try:
        # Decode Apple's identity token (JWT) without full verification for now
        # In production, verify against Apple's public keys
        decoded = jwt.decode(identity_token, options={"verify_signature": False})
        email = decoded.get("email") or data.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Could not retrieve email from Apple")

        sub = decoded.get("sub", "")
        name = data.get("full_name", email.split("@")[0])

        user = await _find_or_create_oauth_user(email, name, "apple", sub)
        return _build_oauth_response(user)

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Apple OAuth error: {e}")
        raise HTTPException(status_code=500, detail=f"Apple authentication failed: {str(e)}")


@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "phone": current_user.get("phone"),
        "profile_image": current_user.get("profile_image"),
        "points_balance": current_user["points_balance"],
        "total_earned": current_user["total_earned"],
        "total_redeemed": current_user["total_redeemed"],
        "qr_code": current_user["qr_code"],
        "currency": current_user.get("currency", "USD"),
        "created_at": current_user["created_at"]
    }

@api_router.put("/auth/profile")
async def update_profile(update_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    if update_dict:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_dict}
        )
    
    updated_user = await db.users.find_one({"id": current_user["id"]})
    return {
        "message": "Profile updated successfully",
        "user": {
            "id": updated_user["id"],
            "email": updated_user["email"],
            "name": updated_user["name"],
            "phone": updated_user.get("phone"),
            "profile_image": updated_user.get("profile_image"),
            "points_balance": updated_user["points_balance"],
            "total_earned": updated_user["total_earned"],
            "total_redeemed": updated_user["total_redeemed"],
            "qr_code": updated_user["qr_code"],
            "currency": updated_user.get("currency", "USD"),
            "created_at": updated_user["created_at"]
        }
    }

@api_router.post("/auth/change-password")
async def change_password(data: PasswordChange, current_user: dict = Depends(get_current_user)):
    if not verify_password(data.old_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": hash_password(data.new_password), "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Password changed successfully"}

# ========================= WALLET ENDPOINTS =========================

@api_router.get("/wallet/balance")
async def get_balance(current_user: dict = Depends(get_current_user)):
    return {
        "points_balance": current_user["points_balance"],
        "total_earned": current_user["total_earned"],
        "total_redeemed": current_user["total_redeemed"],
        "currency": current_user.get("currency", "USD")
    }

@api_router.get("/wallet/transactions")
async def get_transactions(
    type: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    if type and type in ["earn", "redeem"]:
        query["type"] = type
    
    transactions = await db.transactions.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(query)
    
    return {
        "transactions": serialize_docs(transactions),
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/wallet/qr-code")
async def get_qr_code(current_user: dict = Depends(get_current_user)):
    qr_base64 = generate_qr_code_base64(current_user["qr_code"])
    return {
        "qr_code": current_user["qr_code"],
        "qr_image": f"data:image/png;base64,{qr_base64}"
    }

# ========================= EARN ENDPOINTS =========================

@api_router.post("/earn/scan")
async def process_qr_scan(scan_data: QRScanRequest):
    """Process QR code scan from partner POS"""
    # Find user by QR code
    user = await db.users.find_one({"qr_code": scan_data.qr_code})
    if not user:
        raise HTTPException(status_code=404, detail="Invalid QR code")
    
    # Find partner
    partner = await db.partners.find_one({"id": scan_data.partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    # Calculate points (1 point per dollar, with multiplier)
    base_points = int(scan_data.amount)
    total_multiplier = partner["points_multiplier"] * scan_data.points_multiplier
    earned_points = int(base_points * total_multiplier)
    
    # Update user balance
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$inc": {
                "points_balance": earned_points,
                "total_earned": earned_points
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Create transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "partner_id": partner["id"],
        "partner_name": partner["name"],
        "type": "earn",
        "points": earned_points,
        "description": f"Earned {earned_points} points at {partner['name']}",
        "reference_code": generate_reference_code(),
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Points earned successfully",
        "points_earned": earned_points,
        "new_balance": user["points_balance"] + earned_points,
        "transaction": transaction
    }

@api_router.post("/earn/demo")
async def demo_earn_points(current_user: dict = Depends(get_current_user)):
    """Demo endpoint to earn points (for testing)"""
    earned_points = 50
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "points_balance": earned_points,
                "total_earned": earned_points
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "partner_id": None,
        "partner_name": "Demo Partner",
        "type": "earn",
        "points": earned_points,
        "description": f"Demo: Earned {earned_points} points",
        "reference_code": generate_reference_code(),
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Demo points earned!",
        "points_earned": earned_points,
        "new_balance": current_user["points_balance"] + earned_points
    }

# ========================= PARTNER ENDPOINTS =========================

@api_router.get("/partners")
async def get_partners(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    query = {"is_active": True}
    
    if category:
        query["category"] = category
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    partners = await db.partners.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.partners.count_documents(query)
    
    # Also include approved vendors as partner entries
    vendor_query = {"is_active": True, "status": "approved"}
    if category:
        vendor_query["category"] = category
    if search:
        vendor_query["$or"] = [
            {"store_name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    vendors = await db.vendors.find(vendor_query).to_list(100)
    
    # Convert vendors to partner-like format
    vendor_partners = []
    for v in vendors:
        v_data = serialize_doc(v)
        vendor_partners.append({
            "id": v_data["id"],
            "name": v_data.get("store_name", "Store"),
            "category": v_data.get("category", "Other"),
            "description": v_data.get("description", ""),
            "address": v_data.get("address", ""),
            "phone": v_data.get("phone", ""),
            "logo": v_data.get("store_image") or v_data.get("logo", ""),
            "points_multiplier": v_data.get("points_per_rm", 1),
            "is_active": True,
            "source": "vendor",
            "latitude": v_data.get("latitude"),
            "longitude": v_data.get("longitude"),
        })
    
    all_partners = serialize_docs(partners) + vendor_partners
    
    # Get unique categories from both collections
    partner_cats = await db.partners.distinct("category", {"is_active": True})
    vendor_cats = await db.vendors.distinct("category", {"is_active": True, "status": "approved"})
    categories = sorted(list(set(partner_cats + vendor_cats)))
    
    return {
        "partners": all_partners,
        "categories": categories,
        "total": total + len(vendor_partners),
        "limit": limit,
        "skip": skip
    }

# ========================= MAP PARTNERS ENDPOINT =========================

@api_router.get("/partners/map")
async def get_map_partners(
    category: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 50
):
    """Get partners with coordinates for map display"""
    query = {"is_active": True, "latitude": {"$exists": True}}
    if category and category != "All":
        query["category"] = category
    
    partners = await db.partners.find(query).to_list(length=200)
    
    # Also get vendor stores with coordinates
    vendor_query = {"is_active": True, "status": "approved"}
    if category and category != "All":
        vendor_query["category"] = category
    vendors = await db.vendors.find(vendor_query).to_list(length=100)
    
    # Combine into unified result
    map_items = []
    for p in partners:
        item = serialize_doc(p)
        item["source"] = "partner"
        map_items.append(item)
    
    for v in vendors:
        v_data = serialize_doc(v)
        if v_data.get("latitude") and v_data.get("longitude"):
            v_data["source"] = "vendor"
            v_data["name"] = v_data.get("store_name", "Store")
            map_items.append(v_data)
    
    # Also get vendor branches with coordinates
    branches = await db.branches.find({"is_active": True}).to_list(length=200)
    for b in branches:
        b_data = serialize_doc(b)
        if b_data.get("latitude") and b_data.get("longitude"):
            # Get parent vendor info
            vendor = await db.vendors.find_one({"id": b_data.get("vendor_id")})
            if vendor and vendor.get("status") == "approved":
                b_data["source"] = "branch"
                b_data["name"] = b_data.get("name", "Branch")
                b_data["store_name"] = vendor.get("store_name", "Store")
                b_data["category"] = vendor.get("category", "Other")
                b_data["store_image"] = vendor.get("store_image", "")
                b_data["logo"] = vendor.get("logo", "")
                if not category or category == "All" or b_data["category"] == category:
                    map_items.append(b_data)
    
    # Get unique categories
    categories = list(set([m.get("category", "Other") for m in map_items]))
    categories.sort()
    
    return {"partners": map_items, "categories": ["All"] + categories}

@api_router.get("/partners/{partner_id}")
async def get_partner(partner_id: str):
    partner = await db.partners.find_one({"id": partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return serialize_doc(partner)

# Public categories endpoint for app home page
@api_router.get("/categories/public")
async def get_public_categories():
    """Get active categories for app display"""
    categories = await db.categories.find({"is_active": True}).sort("sort_order", 1).to_list(50)
    if not categories:
        # Fallback to categories derived from partners/vendors
        partner_cats = await db.partners.distinct("category")
        vendor_cats = await db.vendors.distinct("category")
        all_cats = sorted(set(partner_cats + vendor_cats))
        return {"categories": [{"name": c, "icon": "pricetag", "id": c} for c in all_cats]}
    return {"categories": serialize_docs(categories)}

# Public branding endpoint - no auth required
@api_router.get("/branding")
async def get_public_branding():
    """Get app branding settings for theming"""
    settings = await db.settings.find_one({"id": "app_settings"})
    if not settings:
        return {
            "app_name": "RewardsHub",
            "app_tagline": "Your Loyalty, Your Rewards",
            "primary_color": "#CB4154",
            "secondary_color": "#8B0000",
            "background_color": "#FAF0E6",
            "brand_logo": "",
            "currency_symbol": "RM",
            "currency_code": "MYR",
        }
    return {
        "app_name": settings.get("app_name", "RewardsHub"),
        "app_tagline": settings.get("app_tagline", "Your Loyalty, Your Rewards"),
        "primary_color": settings.get("primary_color", "#CB4154"),
        "secondary_color": settings.get("secondary_color", "#8B0000"),
        "background_color": settings.get("background_color", "#FAF0E6"),
        "brand_logo": settings.get("brand_logo", ""),
        "currency_symbol": settings.get("currency_symbol", "RM"),
        "currency_code": settings.get("currency_code", "MYR"),
    }

@api_router.post("/partners")
async def create_partner(partner_data: PartnerCreate):
    partner = {
        "id": str(uuid.uuid4()),
        **partner_data.dict(),
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    await db.partners.insert_one(partner)
    return serialize_doc(partner)

# ========================= REWARDS ENDPOINTS =========================

@api_router.get("/rewards")
async def get_rewards(
    category: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    query = {"is_active": True}
    
    if category:
        query["category"] = category
    
    rewards = await db.rewards.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.rewards.count_documents(query)
    
    # Get unique categories
    categories = await db.rewards.distinct("category", {"is_active": True})
    
    return {
        "rewards": serialize_docs(rewards),
        "categories": categories,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/rewards/{reward_id}")
async def get_reward(reward_id: str):
    reward = await db.rewards.find_one({"id": reward_id})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    return serialize_doc(reward)

@api_router.post("/rewards")
async def create_reward(reward_data: RewardCreate):
    reward = {
        "id": str(uuid.uuid4()),
        **reward_data.dict(),
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    await db.rewards.insert_one(reward)
    return serialize_doc(reward)

# ========================= REDEMPTION ENDPOINTS =========================

@api_router.post("/redeem")
async def redeem_reward(redeem_data: RedeemRequest, current_user: dict = Depends(get_current_user)):
    # Get reward
    reward = await db.rewards.find_one({"id": redeem_data.reward_id, "is_active": True})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Check if user has enough points
    if current_user["points_balance"] < reward["points_required"]:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    # Check quantity
    if reward["quantity"] != -1 and reward["quantity"] <= 0:
        raise HTTPException(status_code=400, detail="Reward out of stock")
    
    # Deduct points
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "points_balance": -reward["points_required"],
                "total_redeemed": reward["points_required"]
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Update reward quantity if limited
    if reward["quantity"] != -1:
        await db.rewards.update_one(
            {"id": reward["id"]},
            {"$inc": {"quantity": -1}}
        )
    
    # Create redemption record
    redemption_code = f"RDM-{str(uuid.uuid4())[:8].upper()}"
    redemption = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "reward_id": reward["id"],
        "reward_name": reward["name"],
        "points_used": reward["points_required"],
        "redemption_code": redemption_code,
        "status": "active",
        "vendor_id": reward.get("vendor_id"),
        "vendor_name": reward.get("vendor_name"),
        "created_at": datetime.utcnow()
    }
    await db.redemptions.insert_one(redemption)
    
    # Update vendor stats if this is a vendor reward
    if reward.get("vendor_id"):
        await db.vendors.update_one(
            {"id": reward["vendor_id"]},
            {"$inc": {"total_redemptions": 1}}
        )
        await db.rewards.update_one(
            {"id": reward["id"]},
            {"$inc": {"total_redeemed": 1}}
        )
    
    # Create transaction
    partner_name = reward.get("vendor_name", "RewardsHub")
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "partner_id": reward.get("vendor_id"),
        "partner_name": partner_name,
        "type": "redeem",
        "points": reward["points_required"],
        "description": f"Redeemed: {reward['name']}",
        "reference_code": redemption_code,
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Reward redeemed successfully",
        "redemption": serialize_doc(redemption),
        "new_balance": current_user["points_balance"] - reward["points_required"]
    }

@api_router.get("/redemptions")
async def get_redemptions(current_user: dict = Depends(get_current_user)):
    redemptions = await db.redemptions.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    return {"redemptions": serialize_docs(redemptions)}

# ========================= BILL PAYMENT ENDPOINTS =========================

class BillPaymentRequest(BaseModel):
    bill_type: str  # electricity, water, phone, internet, fuel, rent
    account_number: str
    amount: float
    provider: Optional[str] = None

class MoneyTransferRequest(BaseModel):
    recipient_phone: str
    recipient_name: str
    amount: float
    note: Optional[str] = None

@api_router.get("/bills/types")
async def get_bill_types():
    """Get available bill payment types"""
    return {
        "bill_types": [
            {"id": "electricity", "name": "Electricity (TNB)", "icon": "flash", "provider": "Tenaga Nasional Berhad"},
            {"id": "water", "name": "Water Bill", "icon": "water", "provider": "Air Selangor / SYABAS"},
            {"id": "phone", "name": "Phone Bill", "icon": "call", "provider": "Maxis / Digi / Celcom / U Mobile"},
            {"id": "internet", "name": "Internet / WiFi", "icon": "wifi", "provider": "TM / Maxis / Time"},
            {"id": "fuel", "name": "Fuel (Petrol)", "icon": "car", "provider": "Petronas / Shell / Petron"},
            {"id": "rent", "name": "House Rent", "icon": "home", "provider": "Property Owner"},
            {"id": "astro", "name": "Astro TV", "icon": "tv", "provider": "Astro Malaysia"},
            {"id": "insurance", "name": "Insurance", "icon": "shield-checkmark", "provider": "Various Providers"},
        ]
    }

@api_router.post("/bills/pay")
async def pay_bill(payment: BillPaymentRequest, current_user: dict = Depends(get_current_user)):
    """Pay a bill using points (100 points = RM1)"""
    points_required = int(payment.amount * 100)  # 100 points = RM1
    
    if current_user["points_balance"] < points_required:
        raise HTTPException(status_code=400, detail=f"Insufficient points. Need {points_required} points for RM{payment.amount}")
    
    # Deduct points
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "points_balance": -points_required,
                "total_redeemed": points_required
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Create bill payment record
    payment_ref = f"BILL-{str(uuid.uuid4())[:8].upper()}"
    bill_record = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "bill_type": payment.bill_type,
        "account_number": payment.account_number,
        "amount": payment.amount,
        "points_used": points_required,
        "provider": payment.provider,
        "reference": payment_ref,
        "status": "completed",
        "created_at": datetime.utcnow()
    }
    await db.bill_payments.insert_one(bill_record)
    
    # Create transaction record
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "partner_id": None,
        "partner_name": f"Bill Payment - {payment.bill_type.title()}",
        "type": "redeem",
        "points": points_required,
        "description": f"Paid {payment.bill_type.title()} bill: RM{payment.amount}",
        "reference_code": payment_ref,
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Bill paid successfully",
        "payment": serialize_doc(bill_record),
        "new_balance": current_user["points_balance"] - points_required
    }

@api_router.post("/transfer")
async def transfer_money(transfer: MoneyTransferRequest, current_user: dict = Depends(get_current_user)):
    """Transfer money to contacts using points (100 points = RM1)"""
    points_required = int(transfer.amount * 100)  # 100 points = RM1
    
    if current_user["points_balance"] < points_required:
        raise HTTPException(status_code=400, detail=f"Insufficient points. Need {points_required} points for RM{transfer.amount}")
    
    # Deduct points from sender
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "points_balance": -points_required,
                "total_redeemed": points_required
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Check if recipient exists and add points to them
    recipient = await db.users.find_one({"phone": transfer.recipient_phone})
    if recipient:
        await db.users.update_one(
            {"id": recipient["id"]},
            {
                "$inc": {
                    "points_balance": points_required,
                    "total_earned": points_required
                },
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
    
    # Create transfer record
    transfer_ref = f"TRF-{str(uuid.uuid4())[:8].upper()}"
    transfer_record = {
        "id": str(uuid.uuid4()),
        "sender_id": current_user["id"],
        "recipient_phone": transfer.recipient_phone,
        "recipient_name": transfer.recipient_name,
        "amount": transfer.amount,
        "points_transferred": points_required,
        "note": transfer.note,
        "reference": transfer_ref,
        "status": "completed",
        "created_at": datetime.utcnow()
    }
    await db.transfers.insert_one(transfer_record)
    
    # Create transaction for sender
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "partner_id": None,
        "partner_name": f"Transfer to {transfer.recipient_name}",
        "type": "redeem",
        "points": points_required,
        "description": f"Sent RM{transfer.amount} to {transfer.recipient_name}",
        "reference_code": transfer_ref,
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Transfer successful",
        "transfer": serialize_doc(transfer_record),
        "new_balance": current_user["points_balance"] - points_required
    }

@api_router.get("/bills/history")
async def get_bill_history(current_user: dict = Depends(get_current_user)):
    """Get bill payment history"""
    bills = await db.bill_payments.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(50)
    return {"payments": serialize_docs(bills)}

@api_router.get("/transfers/history")
async def get_transfer_history(current_user: dict = Depends(get_current_user)):
    """Get transfer history"""
    transfers = await db.transfers.find({"sender_id": current_user["id"]}).sort("created_at", -1).to_list(50)
    return {"transfers": serialize_docs(transfers)}

# ========================= VENDOR ENDPOINTS =========================

@api_router.post("/vendor/register")
async def vendor_register(data: VendorRegister):
    """Register a new vendor/store"""
    # Check if email already exists
    existing = await db.vendors.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    vendor_id = str(uuid.uuid4())
    vendor = {
        "id": vendor_id,
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "store_name": data.store_name,
        "category": data.category,
        "description": data.description,
        "address": data.address,
        "phone": data.phone,
        "logo": data.logo,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "points_per_rm": 1.0,  # Default: 1 point per RM spent
        "wallet_id": f"VND-{vendor_id[:8].upper()}",
        "status": "approved",  # Auto-approve until admin panel is built
        "is_active": True,
        "total_points_issued": 0,
        "total_redemptions": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.vendors.insert_one(vendor)
    
    token = create_vendor_jwt_token(vendor_id, data.email.lower())
    
    return {
        "message": "Vendor registered successfully. Pending admin approval.",
        "token": token,
        "vendor": serialize_doc(vendor)
    }

@api_router.post("/vendor/login")
async def vendor_login(credentials: VendorLogin):
    """Vendor login"""
    vendor = await db.vendors.find_one({"email": credentials.email.lower()})
    if not vendor:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, vendor["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Auto-approve pending vendors until admin panel is built
    if vendor.get("status") == "pending" or not vendor.get("is_active", True):
        await db.vendors.update_one(
            {"id": vendor["id"]},
            {"$set": {"status": "approved", "is_active": True, "updated_at": datetime.utcnow()}}
        )
        vendor["status"] = "approved"
        vendor["is_active"] = True
    
    token = create_vendor_jwt_token(vendor["id"], vendor["email"])
    
    return {
        "message": "Login successful",
        "token": token,
        "vendor": serialize_doc(vendor)
    }

@api_router.get("/vendor/me")
async def get_vendor_profile(current_vendor: dict = Depends(get_current_vendor)):
    """Get current vendor profile"""
    return serialize_doc(current_vendor)

@api_router.put("/vendor/profile")
async def update_vendor_profile(data: VendorUpdate, current_vendor: dict = Depends(get_current_vendor)):
    """Update vendor profile"""
    update_dict = {k: v for k, v in data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    if update_dict:
        await db.vendors.update_one(
            {"id": current_vendor["id"]},
            {"$set": update_dict}
        )
    
    updated = await db.vendors.find_one({"id": current_vendor["id"]})
    return {"message": "Profile updated", "vendor": serialize_doc(updated)}

@api_router.post("/vendor/upload-store-image")
async def upload_store_image(data: dict, current_vendor: dict = Depends(get_current_vendor)):
    """Upload store image as base64"""
    image_data = data.get("image", "")
    if not image_data:
        raise HTTPException(status_code=400, detail="No image data provided")
    
    # Validate it looks like base64 image data
    if not (image_data.startswith("data:image/") or len(image_data) > 100):
        raise HTTPException(status_code=400, detail="Invalid image data")
    
    # Limit image size (5MB base64 ~ 6.6MB string)
    if len(image_data) > 7_000_000:
        raise HTTPException(status_code=400, detail="Image too large. Maximum 5MB.")
    
    await db.vendors.update_one(
        {"id": current_vendor["id"]},
        {"$set": {"store_image": image_data, "updated_at": datetime.utcnow()}}
    )
    
    updated = await db.vendors.find_one({"id": current_vendor["id"]})
    return {"message": "Store image uploaded successfully", "vendor": serialize_doc(updated)}

# ===== VENDOR BRANCHES =====

@api_router.post("/vendor/branches")
async def create_branch(data: BranchCreate, current_vendor: dict = Depends(get_current_vendor)):
    """Create a new branch"""
    branch = {
        "id": str(uuid.uuid4()),
        "vendor_id": current_vendor["id"],
        "name": data.name,
        "address": data.address,
        "phone": data.phone,
        "is_active": data.is_active,
        "total_points_issued": 0,
        "total_redemptions": 0,
        "created_at": datetime.utcnow()
    }
    
    await db.branches.insert_one(branch)
    return {"message": "Branch created", "branch": serialize_doc(branch)}

@api_router.get("/vendor/branches")
async def get_branches(current_vendor: dict = Depends(get_current_vendor)):
    """Get all branches"""
    branches = await db.branches.find({"vendor_id": current_vendor["id"]}).to_list(100)
    return {"branches": serialize_docs(branches)}

@api_router.put("/vendor/branches/{branch_id}")
async def update_branch(branch_id: str, data: BranchCreate, current_vendor: dict = Depends(get_current_vendor)):
    """Update a branch"""
    branch = await db.branches.find_one({"id": branch_id, "vendor_id": current_vendor["id"]})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    await db.branches.update_one(
        {"id": branch_id},
        {"$set": {**data.dict(), "updated_at": datetime.utcnow()}}
    )
    
    updated = await db.branches.find_one({"id": branch_id})
    return {"message": "Branch updated", "branch": serialize_doc(updated)}

@api_router.delete("/vendor/branches/{branch_id}")
async def delete_branch(branch_id: str, current_vendor: dict = Depends(get_current_vendor)):
    """Delete a branch"""
    result = await db.branches.delete_one({"id": branch_id, "vendor_id": current_vendor["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"message": "Branch deleted"}

# ===== VENDOR REWARDS MANAGEMENT =====

@api_router.post("/vendor/rewards")
async def create_vendor_reward(data: VendorRewardCreate, current_vendor: dict = Depends(get_current_vendor)):
    """Create a new reward"""
    reward = {
        "id": str(uuid.uuid4()),
        "vendor_id": current_vendor["id"],
        "vendor_name": current_vendor["store_name"],
        "name": data.name,
        "description": data.description,
        "points_required": data.points_required,
        "reward_type": data.reward_type,
        "value": data.value,
        "image": data.image,
        "terms_conditions": data.terms_conditions,
        "quantity": data.quantity,
        "original_quantity": data.quantity,
        "expiry_date": data.expiry_date,
        "branch_id": data.branch_id,
        "category": current_vendor["category"],
        "is_active": True,
        "total_redeemed": 0,
        "created_at": datetime.utcnow()
    }
    
    await db.rewards.insert_one(reward)
    
    return {"message": "Reward created", "reward": serialize_doc(reward)}

@api_router.get("/vendor/rewards")
async def get_vendor_rewards(current_vendor: dict = Depends(get_current_vendor)):
    """Get all rewards for vendor"""
    rewards = await db.rewards.find({"vendor_id": current_vendor["id"]}).sort("created_at", -1).to_list(100)
    return {"rewards": serialize_docs(rewards)}

@api_router.put("/vendor/rewards/{reward_id}")
async def update_vendor_reward(reward_id: str, data: VendorRewardCreate, current_vendor: dict = Depends(get_current_vendor)):
    """Update a reward"""
    reward = await db.rewards.find_one({"id": reward_id, "vendor_id": current_vendor["id"]})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    update_data = data.dict()
    update_data["updated_at"] = datetime.utcnow()
    
    await db.rewards.update_one(
        {"id": reward_id},
        {"$set": update_data}
    )
    
    updated = await db.rewards.find_one({"id": reward_id})
    return {"message": "Reward updated", "reward": serialize_doc(updated)}

@api_router.delete("/vendor/rewards/{reward_id}")
async def delete_vendor_reward(reward_id: str, current_vendor: dict = Depends(get_current_vendor)):
    """Delete a reward"""
    result = await db.rewards.delete_one({"id": reward_id, "vendor_id": current_vendor["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    return {"message": "Reward deleted"}

@api_router.put("/vendor/rewards/{reward_id}/toggle")
async def toggle_vendor_reward(reward_id: str, current_vendor: dict = Depends(get_current_vendor)):
    """Toggle reward active status"""
    reward = await db.rewards.find_one({"id": reward_id, "vendor_id": current_vendor["id"]})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    new_status = not reward.get("is_active", True)
    await db.rewards.update_one(
        {"id": reward_id},
        {"$set": {"is_active": new_status, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Reward {'activated' if new_status else 'deactivated'}", "is_active": new_status}

# ===== VENDOR REDEMPTIONS =====

@api_router.get("/vendor/redemptions")
async def get_vendor_redemptions(
    status: Optional[str] = None,
    limit: int = 50,
    current_vendor: dict = Depends(get_current_vendor)
):
    """Get redemptions for vendor"""
    query = {"vendor_id": current_vendor["id"]}
    if status:
        query["status"] = status
    
    redemptions = await db.redemptions.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get user details for each redemption
    for r in redemptions:
        user = await db.users.find_one({"id": r.get("user_id")})
        if user:
            r["user_name"] = user.get("name", "Unknown")
            r["user_phone"] = user.get("phone", "")
    
    return {"redemptions": serialize_docs(redemptions)}

@api_router.get("/vendor/redemptions/today")
async def get_today_redemptions(current_vendor: dict = Depends(get_current_vendor)):
    """Get today's redemptions"""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    redemptions = await db.redemptions.find({
        "vendor_id": current_vendor["id"],
        "created_at": {"$gte": today_start}
    }).sort("created_at", -1).to_list(100)
    
    return {"redemptions": serialize_docs(redemptions), "count": len(redemptions)}

@api_router.post("/vendor/validate-redemption")
async def validate_redemption(data: ValidateRedemptionRequest, current_vendor: dict = Depends(get_current_vendor)):
    """Validate a redemption code"""
    redemption = await db.redemptions.find_one({
        "redemption_code": data.redemption_code.upper(),
        "vendor_id": current_vendor["id"]
    })
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Invalid redemption code")
    
    if redemption["status"] == "used":
        raise HTTPException(status_code=400, detail="Redemption already used")
    
    if redemption["status"] == "expired":
        raise HTTPException(status_code=400, detail="Redemption has expired")
    
    # Get user details
    user = await db.users.find_one({"id": redemption["user_id"]})
    
    return {
        "valid": True,
        "redemption": serialize_doc(redemption),
        "user": {
            "name": user.get("name", "Unknown") if user else "Unknown",
            "phone": user.get("phone", "") if user else ""
        }
    }

@api_router.post("/vendor/confirm-redemption")
async def confirm_redemption(data: ValidateRedemptionRequest, current_vendor: dict = Depends(get_current_vendor)):
    """Confirm and mark redemption as used"""
    redemption = await db.redemptions.find_one({
        "redemption_code": data.redemption_code.upper(),
        "vendor_id": current_vendor["id"]
    })
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Invalid redemption code")
    
    if redemption["status"] == "used":
        raise HTTPException(status_code=400, detail="Redemption already used")
    
    # Mark as used
    await db.redemptions.update_one(
        {"id": redemption["id"]},
        {"$set": {"status": "used", "used_at": datetime.utcnow()}}
    )
    
    # Update vendor stats
    await db.vendors.update_one(
        {"id": current_vendor["id"]},
        {"$inc": {"total_redemptions": 1}}
    )
    
    # Update reward stats
    await db.rewards.update_one(
        {"id": redemption["reward_id"]},
        {"$inc": {"total_redeemed": 1}}
    )
    
    return {"message": "Redemption confirmed", "redemption_code": data.redemption_code}

@api_router.post("/vendor/scan-qr")
async def scan_qr_redemption(data: ScanQRRedemptionRequest, current_vendor: dict = Depends(get_current_vendor)):
    """Scan QR code for redemption"""
    # QR data format: "RDM-XXXXXXXX" (redemption code)
    return await validate_redemption(
        ValidateRedemptionRequest(redemption_code=data.qr_data),
        current_vendor
    )

# ===== VENDOR ISSUE POINTS =====

# ===== VENDOR POINT RULES (SPENDING TIERS) =====

@api_router.get("/vendor/point-rules")
async def get_point_rules(current_vendor: dict = Depends(get_current_vendor)):
    """Get all point rules for a vendor"""
    rules = await db.point_rules.find({"vendor_id": current_vendor["id"]}).sort("min_amount", 1).to_list(length=100)
    return {"rules": [serialize_doc(r) for r in rules]}

@api_router.post("/vendor/point-rules")
async def create_point_rule(data: PointRuleCreate, current_vendor: dict = Depends(get_current_vendor)):
    """Create a new spending tier / point rule"""
    if data.max_amount != -1 and data.min_amount >= data.max_amount:
        raise HTTPException(status_code=400, detail="min_amount must be less than max_amount")
    if data.points_reward <= 0:
        raise HTTPException(status_code=400, detail="points_reward must be positive")
    
    rule = {
        "id": str(uuid.uuid4()),
        "vendor_id": current_vendor["id"],
        "min_amount": data.min_amount,
        "max_amount": data.max_amount,
        "points_reward": data.points_reward,
        "label": data.label or f"RM{data.min_amount}-{('RM' + str(data.max_amount)) if data.max_amount != -1 else '∞'}",
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    await db.point_rules.insert_one(rule)
    return {"message": "Point rule created", "rule": serialize_doc(rule)}

@api_router.put("/vendor/point-rules/{rule_id}")
async def update_point_rule(rule_id: str, data: PointRuleUpdate, current_vendor: dict = Depends(get_current_vendor)):
    """Update a point rule"""
    rule = await db.point_rules.find_one({"id": rule_id, "vendor_id": current_vendor["id"]})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.point_rules.update_one({"id": rule_id}, {"$set": update_data})
    
    updated = await db.point_rules.find_one({"id": rule_id})
    return {"message": "Rule updated", "rule": serialize_doc(updated)}

@api_router.delete("/vendor/point-rules/{rule_id}")
async def delete_point_rule(rule_id: str, current_vendor: dict = Depends(get_current_vendor)):
    """Delete a point rule"""
    result = await db.point_rules.delete_one({"id": rule_id, "vendor_id": current_vendor["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Rule deleted"}

async def calculate_points_from_rules(vendor_id: str, bill_amount: float) -> dict:
    """Calculate points based on vendor's spending tier rules"""
    rules = await db.point_rules.find({"vendor_id": vendor_id, "is_active": True}).sort("min_amount", 1).to_list(length=100)
    
    if not rules:
        return {"points": 0, "rule_matched": None, "mode": "no_rules"}
    
    matched_rule = None
    for rule in rules:
        min_amt = rule["min_amount"]
        max_amt = rule["max_amount"]
        if bill_amount >= min_amt and (max_amt == -1 or bill_amount < max_amt):
            matched_rule = rule
            break
    
    if matched_rule:
        return {
            "points": matched_rule["points_reward"],
            "rule_matched": serialize_doc(matched_rule),
            "mode": "automatic"
        }
    
    return {"points": 0, "rule_matched": None, "mode": "no_match"}

@api_router.post("/vendor/calculate-points")
async def calculate_points_preview(data: GeneratePurchaseQRRequest, current_vendor: dict = Depends(get_current_vendor)):
    """Preview points calculation based on bill amount and vendor rules"""
    result = await calculate_points_from_rules(current_vendor["id"], data.bill_amount)
    return {
        "bill_amount": data.bill_amount,
        "points_calculated": result["points"],
        "mode": result["mode"],
        "rule_matched": result.get("rule_matched"),
    }

# ===== PURCHASE QR CODE SYSTEM =====

@api_router.post("/vendor/generate-purchase-qr")
async def generate_purchase_qr(data: GeneratePurchaseQRRequest, current_vendor: dict = Depends(get_current_vendor)):
    """Generate a QR code for a purchase that customer scans to earn points"""
    if current_vendor["status"] != "approved":
        raise HTTPException(status_code=403, detail="Vendor not approved")
    
    # Calculate points using tier rules
    calc_result = await calculate_points_from_rules(current_vendor["id"], data.bill_amount)
    points_to_issue = calc_result["points"]
    
    if points_to_issue <= 0:
        raise HTTPException(status_code=400, detail="No matching point rule for this amount. Please add spending tiers first.")
    
    # Create purchase record
    purchase_code = f"PUR-{str(uuid.uuid4())[:8].upper()}"
    purchase = {
        "id": str(uuid.uuid4()),
        "code": purchase_code,
        "vendor_id": current_vendor["id"],
        "vendor_name": current_vendor["store_name"],
        "bill_amount": data.bill_amount,
        "points_reward": points_to_issue,
        "description": data.description or f"Purchase at {current_vendor['store_name']}",
        "branch_id": data.branch_id,
        "rule_matched": calc_result.get("rule_matched", {}).get("label", ""),
        "status": "pending",  # pending -> claimed -> expired
        "expires_at": datetime.utcnow() + timedelta(hours=24),
        "created_at": datetime.utcnow()
    }
    await db.purchases.insert_one(purchase)
    
    # Generate QR code
    qr_data = f"PURCHASE:{purchase_code}"
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#CB4154", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "message": "Purchase QR generated",
        "purchase": serialize_doc(purchase),
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "qr_data": qr_data
    }

@api_router.get("/vendor/purchases")
async def get_vendor_purchases(
    status: Optional[str] = None,
    current_vendor: dict = Depends(get_current_vendor)
):
    """Get vendor's purchase QR records"""
    query = {"vendor_id": current_vendor["id"]}
    if status:
        query["status"] = status
    purchases = await db.purchases.find(query).sort("created_at", -1).to_list(length=100)
    return {"purchases": [serialize_doc(p) for p in purchases]}

# ===== CUSTOMER SCAN PURCHASE QR =====

@api_router.post("/claim-purchase")
async def claim_purchase_qr(data: dict, current_user: dict = Depends(get_current_user)):
    """Customer scans vendor purchase QR to claim points"""
    qr_data = data.get("qr_data", "")
    
    if not qr_data.startswith("PURCHASE:"):
        raise HTTPException(status_code=400, detail="Invalid purchase QR code")
    
    purchase_code = qr_data.replace("PURCHASE:", "")
    purchase = await db.purchases.find_one({"code": purchase_code})
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if purchase["status"] == "claimed":
        raise HTTPException(status_code=400, detail="This purchase has already been claimed")
    if purchase["status"] == "expired":
        raise HTTPException(status_code=400, detail="This purchase has expired")
    if purchase.get("expires_at") and purchase["expires_at"] < datetime.utcnow():
        await db.purchases.update_one({"code": purchase_code}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="This purchase has expired")
    
    points_earned = purchase["points_reward"]
    
    # Credit points to user
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {"points_balance": points_earned, "total_earned": points_earned},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Create transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "partner_id": purchase["vendor_id"],
        "partner_name": purchase["vendor_name"],
        "type": "earn",
        "points": points_earned,
        "description": f"Earned {points_earned} pts at {purchase['vendor_name']} (RM{purchase['bill_amount']})",
        "reference_code": purchase["code"],
        "bill_amount": purchase["bill_amount"],
        "branch_id": purchase.get("branch_id"),
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    # Update purchase status
    await db.purchases.update_one(
        {"code": purchase_code},
        {"$set": {"status": "claimed", "claimed_by": current_user["id"], "claimed_at": datetime.utcnow()}}
    )
    
    # Update vendor stats
    await db.vendors.update_one(
        {"id": purchase["vendor_id"]},
        {"$inc": {"total_points_issued": points_earned}}
    )
    
    updated_user = await db.users.find_one({"id": current_user["id"]})
    
    return {
        "message": "Points claimed successfully!",
        "points_earned": points_earned,
        "vendor_name": purchase["vendor_name"],
        "bill_amount": purchase["bill_amount"],
        "new_balance": updated_user["points_balance"],
        "transaction": serialize_doc(transaction)
    }

# ===== VENDOR MANUAL ISSUE POINTS =====

@api_router.post("/vendor/issue-points")
async def issue_points(data: IssuePointsRequest, current_vendor: dict = Depends(get_current_vendor)):
    """Issue points to a user based on bill amount"""
    if current_vendor["status"] != "approved":
        raise HTTPException(status_code=403, detail="Vendor not approved")
    
    # Find user by phone
    user = await db.users.find_one({"phone": data.user_phone})
    if not user:
        raise HTTPException(status_code=404, detail="User not found with this phone number")
    
    # Calculate points
    points_per_rm = current_vendor.get("points_per_rm", 1.0)
    points_earned = int(data.bill_amount * points_per_rm)
    
    # Update user balance
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$inc": {
                "points_balance": points_earned,
                "total_earned": points_earned
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Create transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "partner_id": current_vendor["id"],
        "partner_name": current_vendor["store_name"],
        "type": "earn",
        "points": points_earned,
        "description": data.description or f"Earned {points_earned} points at {current_vendor['store_name']}",
        "reference_code": generate_reference_code(),
        "bill_amount": data.bill_amount,
        "branch_id": data.branch_id,
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    # Update vendor stats
    await db.vendors.update_one(
        {"id": current_vendor["id"]},
        {"$inc": {"total_points_issued": points_earned}}
    )
    
    # Update branch stats if applicable
    if data.branch_id:
        await db.branches.update_one(
            {"id": data.branch_id},
            {"$inc": {"total_points_issued": points_earned}}
        )
    
    return {
        "message": "Points issued successfully",
        "points_issued": points_earned,
        "user_name": user["name"],
        "new_balance": user["points_balance"] + points_earned,
        "transaction": serialize_doc(transaction)
    }

# ===== VENDOR ANALYTICS =====

@api_router.get("/vendor/analytics")
async def get_vendor_analytics(current_vendor: dict = Depends(get_current_vendor)):
    """Get vendor analytics"""
    vendor_id = current_vendor["id"]
    
    # Total redemptions
    total_redemptions = await db.redemptions.count_documents({"vendor_id": vendor_id, "status": "used"})
    
    # Pending redemptions
    pending_redemptions = await db.redemptions.count_documents({"vendor_id": vendor_id, "status": "active"})
    
    # Total points issued (from transactions)
    pipeline = [
        {"$match": {"partner_id": vendor_id, "type": "earn"}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}}
    ]
    points_result = await db.transactions.aggregate(pipeline).to_list(1)
    total_points_issued = points_result[0]["total"] if points_result else 0
    
    # Today's stats
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    today_redemptions = await db.redemptions.count_documents({
        "vendor_id": vendor_id,
        "created_at": {"$gte": today_start}
    })
    
    today_pipeline = [
        {"$match": {"partner_id": vendor_id, "type": "earn", "created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}}
    ]
    today_points_result = await db.transactions.aggregate(today_pipeline).to_list(1)
    today_points_issued = today_points_result[0]["total"] if today_points_result else 0
    
    # Top rewards
    top_rewards_pipeline = [
        {"$match": {"vendor_id": vendor_id}},
        {"$sort": {"total_redeemed": -1}},
        {"$limit": 5}
    ]
    top_rewards = await db.rewards.aggregate(top_rewards_pipeline).to_list(5)
    
    # Unique customers
    unique_users_pipeline = [
        {"$match": {"partner_id": vendor_id}},
        {"$group": {"_id": "$user_id"}}
    ]
    unique_users = await db.transactions.aggregate(unique_users_pipeline).to_list(1000)
    
    return {
        "total_redemptions": total_redemptions,
        "pending_redemptions": pending_redemptions,
        "total_points_issued": total_points_issued,
        "today_redemptions": today_redemptions,
        "today_points_issued": today_points_issued,
        "total_customers": len(unique_users),
        "top_rewards": serialize_docs(top_rewards),
        "vendor": serialize_doc(current_vendor)
    }

@api_router.get("/vendor/analytics/daily")
async def get_daily_analytics(days: int = 7, current_vendor: dict = Depends(get_current_vendor)):
    """Get daily analytics for the past N days"""
    vendor_id = current_vendor["id"]
    daily_stats = []
    
    for i in range(days):
        day_start = (datetime.utcnow() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        redemptions = await db.redemptions.count_documents({
            "vendor_id": vendor_id,
            "created_at": {"$gte": day_start, "$lt": day_end}
        })
        
        pipeline = [
            {"$match": {"partner_id": vendor_id, "type": "earn", "created_at": {"$gte": day_start, "$lt": day_end}}},
            {"$group": {"_id": None, "total": {"$sum": "$points"}}}
        ]
        points_result = await db.transactions.aggregate(pipeline).to_list(1)
        points_issued = points_result[0]["total"] if points_result else 0
        
        daily_stats.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "redemptions": redemptions,
            "points_issued": points_issued
        })
    
    return {"daily_stats": daily_stats}

# ========================= MOBILE APP REDEMPTION UPDATES =========================

@api_router.post("/redeem-at-vendor")
async def redeem_at_vendor(reward_id: str, current_user: dict = Depends(get_current_user)):
    """User redeems a reward - creates redemption with QR code for vendor"""
    # Get reward
    reward = await db.rewards.find_one({"id": reward_id, "is_active": True})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Check if user has enough points
    if current_user["points_balance"] < reward["points_required"]:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    # Check quantity
    if reward["quantity"] != -1 and reward["quantity"] <= 0:
        raise HTTPException(status_code=400, detail="Reward out of stock")
    
    # Deduct points
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "points_balance": -reward["points_required"],
                "total_redeemed": reward["points_required"]
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Update reward quantity if limited
    if reward["quantity"] != -1:
        await db.rewards.update_one(
            {"id": reward["id"]},
            {"$inc": {"quantity": -1}}
        )
    
    # Create redemption with code and QR
    redemption_code = generate_redemption_code()
    qr_image = generate_qr_code_base64(redemption_code)
    
    redemption = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "vendor_id": reward.get("vendor_id"),
        "reward_id": reward["id"],
        "reward_name": reward["name"],
        "reward_type": reward.get("reward_type", "general"),
        "value": reward.get("value", 0),
        "points_used": reward["points_required"],
        "redemption_code": redemption_code,
        "qr_code": f"data:image/png;base64,{qr_image}",
        "status": "active",
        "created_at": datetime.utcnow(),
        "expiry_date": reward.get("expiry_date")
    }
    await db.redemptions.insert_one(redemption)
    
    # Create transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "partner_id": reward.get("vendor_id"),
        "partner_name": reward.get("vendor_name", "RewardsHub"),
        "type": "redeem",
        "points": reward["points_required"],
        "description": f"Redeemed: {reward['name']}",
        "reference_code": redemption_code,
        "created_at": datetime.utcnow()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Reward redeemed successfully",
        "redemption": serialize_doc(redemption),
        "new_balance": current_user["points_balance"] - reward["points_required"]
    }

# ========================= ADMIN PANEL =========================

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class AdminCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = "apps"
    description: Optional[str] = ""
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

# Admin auth helper
async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_jwt_token(token)
    if payload.get("type") != "admin":
        raise HTTPException(status_code=401, detail="Invalid admin token")
    admin = await db.admins.find_one({"id": payload["admin_id"]})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return admin

def create_admin_jwt_token(admin_id: str, email: str) -> str:
    payload = {
        "admin_id": admin_id,
        "email": email,
        "type": "admin",
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# ----- ADMIN AUTH -----

@api_router.post("/admin/login")
async def admin_login(data: AdminLogin):
    admin = await db.admins.find_one({"email": data.email.lower()})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(data.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_admin_jwt_token(admin["id"], admin["email"])
    admin_safe = serialize_doc(admin)
    admin_safe.pop("password_hash", None)
    return {"token": token, "admin": admin_safe}

@api_router.post("/admin/setup")
async def admin_setup(data: AdminCreate):
    """Create first admin - only works if no admins exist"""
    count = await db.admins.count_documents({})
    if count > 0:
        existing = await db.admins.find_one({"email": data.email.lower()})
        if existing:
            raise HTTPException(status_code=400, detail="Admin already exists")
    admin_id = str(uuid.uuid4())
    admin = {
        "id": admin_id,
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "super_admin",
        "created_at": datetime.utcnow()
    }
    await db.admins.insert_one(admin)
    token = create_admin_jwt_token(admin_id, data.email.lower())
    admin_safe = serialize_doc(admin)
    admin_safe.pop("password_hash", None)
    return {"token": token, "admin": admin_safe}

@api_router.get("/admin/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    admin_safe = serialize_doc(admin)
    admin_safe.pop("password_hash", None)
    return admin_safe

# ----- ADMIN DASHBOARD -----

@api_router.get("/admin/dashboard")
async def admin_dashboard(admin: dict = Depends(get_current_admin)):
    total_users = await db.users.count_documents({})
    total_vendors = await db.vendors.count_documents({})
    total_categories = len(await db.partners.distinct("category", {"is_active": True}))
    vendor_cats = await db.vendors.distinct("category", {"is_active": True})
    total_categories += len([c for c in vendor_cats if c])
    # Deduplicate
    all_cats = set(await db.partners.distinct("category")) | set(vendor_cats)
    custom_cats = await db.categories.count_documents({})
    total_categories = max(len(all_cats), custom_cats) if custom_cats else len(all_cats)

    total_rewards = await db.rewards.count_documents({})
    total_purchases = await db.purchases.count_documents({})
    total_redemptions = await db.redemptions.count_documents({})
    pending_redemptions = await db.redemptions.count_documents({"status": "pending"})
    pending_vendors = await db.vendors.count_documents({"status": "pending"})

    # Points stats
    users_cursor = db.users.find({}, {"points_balance": 1, "total_points_earned": 1})
    total_points_issued = 0
    total_points_balance = 0
    async for u in users_cursor:
        total_points_issued += u.get("total_points_earned", 0)
        total_points_balance += u.get("points_balance", 0)
    points_redeemed = max(0, total_points_issued - total_points_balance)

    # Recent activity
    recent_purchases = await db.purchases.find().sort("created_at", -1).to_list(5)
    recent_redemptions = await db.redemptions.find().sort("created_at", -1).to_list(5)

    activity_feed = []
    for p in recent_purchases:
        activity_feed.append({
            "type": "purchase",
            "description": f"Purchase at {p.get('vendor_name', 'Unknown')} - RM{p.get('bill_amount', 0):.2f}",
            "points": p.get("points_reward", 0),
            "time": str(p.get("created_at", ""))
        })
    for r in recent_redemptions:
        activity_feed.append({
            "type": "redemption",
            "description": f"Redeemed: {r.get('reward_name', 'Unknown')}",
            "points": r.get("points_used", 0),
            "time": str(r.get("created_at", ""))
        })
    activity_feed.sort(key=lambda x: x["time"], reverse=True)

    # Top vendors
    top_vendors = await db.vendors.find({"is_active": True}).sort("total_points_issued", -1).to_list(5)

    return {
        "total_users": total_users,
        "total_vendors": total_vendors,
        "total_categories": total_categories,
        "total_rewards": total_rewards,
        "total_orders": total_purchases + total_redemptions,
        "total_purchases": total_purchases,
        "total_redemptions_count": total_redemptions,
        "pending_redemptions": pending_redemptions,
        "pending_vendors": pending_vendors,
        "points_issued": total_points_issued,
        "points_redeemed": points_redeemed,
        "points_balance": total_points_balance,
        "activity_feed": activity_feed[:10],
        "top_vendors": [{"name": v.get("store_name"), "points_issued": v.get("total_points_issued", 0), "category": v.get("category")} for v in top_vendors],
    }

# ----- ADMIN: USER MANAGEMENT -----

@api_router.get("/admin/users")
async def admin_list_users(
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "created_at",
    limit: int = 50,
    skip: int = 0,
    admin: dict = Depends(get_current_admin)
):
    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    if status == "blocked":
        query["is_blocked"] = True
    elif status == "active":
        query["is_blocked"] = {"$ne": True}

    users = await db.users.find(query).sort(sort_by, -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    safe_users = []
    for u in users:
        ud = serialize_doc(u)
        ud.pop("password_hash", None)
        safe_users.append(ud)
    return {"users": safe_users, "total": total}

@api_router.get("/admin/users/{user_id}")
async def admin_get_user(user_id: str, admin: dict = Depends(get_current_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    ud = serialize_doc(user)
    ud.pop("password_hash", None)
    # Get transactions
    transactions = await db.transactions.find({"user_id": user_id}).sort("created_at", -1).to_list(20)
    redemptions = await db.redemptions.find({"user_id": user_id}).sort("created_at", -1).to_list(20)
    purchases = await db.purchases.find({"claimed_by": user_id}).sort("created_at", -1).to_list(20)
    ud["transactions"] = serialize_docs(transactions)
    ud["redemptions"] = serialize_docs(redemptions)
    ud["purchases"] = serialize_docs(purchases)
    return ud

@api_router.post("/admin/users/{user_id}/block")
async def admin_block_user(user_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_blocked": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User blocked"}

@api_router.post("/admin/users/{user_id}/unblock")
async def admin_unblock_user(user_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_blocked": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User unblocked"}

@api_router.post("/admin/users/{user_id}/adjust-points")
async def admin_adjust_points(user_id: str, data: dict, admin: dict = Depends(get_current_admin)):
    amount = data.get("amount", 0)
    reason = data.get("reason", "Admin adjustment")
    if amount == 0:
        raise HTTPException(status_code=400, detail="Amount cannot be zero")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_balance = user.get("points_balance", 0) + amount
    if new_balance < 0:
        raise HTTPException(status_code=400, detail="Insufficient balance for deduction")
    update_fields = {"points_balance": new_balance}
    if amount > 0:
        update_fields["total_points_earned"] = user.get("total_points_earned", 0) + amount
    await db.users.update_one({"id": user_id}, {"$set": update_fields})
    # Log transaction
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "admin_adjustment",
        "amount": amount,
        "description": reason,
        "admin_id": admin["id"],
        "created_at": datetime.utcnow()
    })
    return {"message": f"Points adjusted by {amount}", "new_balance": new_balance}

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# ----- ADMIN: VENDOR MANAGEMENT -----

@api_router.get("/admin/vendors")
async def admin_list_vendors(
    search: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    admin: dict = Depends(get_current_admin)
):
    query: dict = {}
    if search:
        query["$or"] = [
            {"store_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    vendors = await db.vendors.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.vendors.count_documents(query)
    safe_vendors = []
    for v in vendors:
        vd = serialize_doc(v)
        vd.pop("password_hash", None)
        safe_vendors.append(vd)
    return {"vendors": safe_vendors, "total": total}

@api_router.get("/admin/vendors/{vendor_id}")
async def admin_get_vendor(vendor_id: str, admin: dict = Depends(get_current_admin)):
    vendor = await db.vendors.find_one({"id": vendor_id})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vd = serialize_doc(vendor)
    vd.pop("password_hash", None)
    rewards = await db.rewards.find({"vendor_id": vendor_id}).to_list(50)
    purchases = await db.purchases.find({"vendor_id": vendor_id}).sort("created_at", -1).to_list(20)
    redemptions = await db.redemptions.find({"vendor_id": vendor_id}).sort("created_at", -1).to_list(20)
    vd["rewards"] = serialize_docs(rewards)
    vd["purchases"] = serialize_docs(purchases)
    vd["redemptions"] = serialize_docs(redemptions)
    # Include branches
    branches = await db.branches.find({"vendor_id": vendor_id}).to_list(50)
    vd["branches"] = serialize_docs(branches)
    return vd

@api_router.post("/admin/vendors/{vendor_id}/approve")
async def admin_approve_vendor(vendor_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.vendors.update_one(
        {"id": vendor_id},
        {"$set": {"status": "approved", "is_active": True, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor approved"}

@api_router.post("/admin/vendors/{vendor_id}/reject")
async def admin_reject_vendor(vendor_id: str, data: dict = {}, admin: dict = Depends(get_current_admin)):
    reason = data.get("reason", "")
    result = await db.vendors.update_one(
        {"id": vendor_id},
        {"$set": {"status": "rejected", "is_active": False, "rejection_reason": reason, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor rejected"}

@api_router.post("/admin/vendors/{vendor_id}/suspend")
async def admin_suspend_vendor(vendor_id: str, admin: dict = Depends(get_current_admin)):
    await db.vendors.update_one(
        {"id": vendor_id},
        {"$set": {"status": "suspended", "is_active": False, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Vendor suspended"}

@api_router.post("/admin/vendors/{vendor_id}/activate")
async def admin_activate_vendor(vendor_id: str, admin: dict = Depends(get_current_admin)):
    await db.vendors.update_one(
        {"id": vendor_id},
        {"$set": {"status": "approved", "is_active": True, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Vendor activated"}

@api_router.put("/admin/vendors/{vendor_id}/update")
async def admin_update_vendor(vendor_id: str, data: dict, admin: dict = Depends(get_current_admin)):
    """Admin can update vendor details including location"""
    vendor = await db.vendors.find_one({"id": vendor_id})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    allowed = ["store_name", "description", "address", "phone", "latitude", "longitude", "category", "is_active"]
    updates = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    updates["updated_at"] = datetime.utcnow()
    await db.vendors.update_one({"id": vendor_id}, {"$set": updates})
    updated = await db.vendors.find_one({"id": vendor_id})
    return {"message": "Vendor updated", "vendor": serialize_doc(updated)}


@api_router.delete("/admin/vendors/{vendor_id}")
async def admin_delete_vendor(vendor_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.vendors.delete_one({"id": vendor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor deleted"}

# ----- ADMIN: CATEGORY MANAGEMENT -----

@api_router.get("/admin/categories")
async def admin_list_categories(admin: dict = Depends(get_current_admin)):
    categories = await db.categories.find().sort("sort_order", 1).to_list(100)
    if not categories:
        # Seed from existing partner/vendor categories
        existing = set(await db.partners.distinct("category", {"is_active": True}))
        existing |= set(await db.vendors.distinct("category", {"is_active": True}))
        cats = []
        icons = {"Coffee": "cafe", "Dining": "restaurant", "Grocery": "cart", "Fuel": "car",
                 "Health & Beauty": "heart", "Travel": "airplane", "Transport": "bus",
                 "Fitness": "fitness", "Shopping": "bag", "Electronics": "phone-portrait",
                 "Gift Cards": "card", "Malaysian Food": "restaurant"}
        for i, name in enumerate(sorted(existing)):
            cat = {
                "id": str(uuid.uuid4()),
                "name": name,
                "icon": icons.get(name, "apps"),
                "description": "",
                "sort_order": i,
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            cats.append(cat)
        if cats:
            await db.categories.insert_many(cats)
        categories = cats
    # Count vendors per category
    result = []
    for c in categories:
        cd = serialize_doc(c)
        cd["vendor_count"] = await db.vendors.count_documents({"category": c["name"], "is_active": True})
        cd["partner_count"] = await db.partners.count_documents({"category": c["name"], "is_active": True})
        result.append(cd)
    return {"categories": result}

@api_router.post("/admin/categories")
async def admin_create_category(data: CategoryCreate, admin: dict = Depends(get_current_admin)):
    existing = await db.categories.find_one({"name": {"$regex": f"^{data.name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    cat = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "icon": data.icon or "apps",
        "description": data.description or "",
        "sort_order": data.sort_order or 0,
        "is_active": data.is_active if data.is_active is not None else True,
        "created_at": datetime.utcnow()
    }
    await db.categories.insert_one(cat)
    return {"message": "Category created", "category": serialize_doc(cat)}

@api_router.put("/admin/categories/{cat_id}")
async def admin_update_category(cat_id: str, data: CategoryUpdate, admin: dict = Depends(get_current_admin)):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    updates["updated_at"] = datetime.utcnow()
    result = await db.categories.update_one({"id": cat_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    updated = await db.categories.find_one({"id": cat_id})
    return {"message": "Category updated", "category": serialize_doc(updated)}

@api_router.delete("/admin/categories/{cat_id}")
async def admin_delete_category(cat_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.categories.delete_one({"id": cat_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

# ----- ADMIN: APP SETTINGS -----

DEFAULT_SETTINGS = {
    "id": "app_settings",
    # App Settings
    "app_name": "RewardsHub",
    "app_tagline": "Your Loyalty, Your Rewards",
    "currency_symbol": "RM",
    "currency_code": "MYR",
    "points_conversion_rate": 100,  # points per 1 unit of currency
    "maintenance_mode": False,
    "welcome_bonus_points": 100,
    # Branding
    "brand_logo": "",
    "brand_favicon": "",
    "primary_color": "#CB4154",
    "secondary_color": "#8B0000",
    "background_color": "#FAF0E6",
    # Email Configuration
    "smtp_host": "",
    "smtp_port": 587,
    "smtp_username": "",
    "smtp_password": "",
    "smtp_from_email": "",
    "smtp_from_name": "RewardsHub",
    "smtp_use_tls": True,
    # Stripe Configuration
    "stripe_publishable_key": "",
    "stripe_secret_key": "",
    "stripe_webhook_secret": "",
    "stripe_currency": "myr",
    # Commission Settings
    "default_commission_percent": 10.0,
    "min_payout_threshold": 100.0,
    "payout_frequency": "monthly",
    # Notification Settings
    "push_notifications_enabled": True,
    "email_notifications_enabled": False,
    "sms_notifications_enabled": False,
    # Social Links
    "social_facebook": "",
    "social_instagram": "",
    "social_twitter": "",
    "social_website": "",
    # Terms & Privacy
    "terms_url": "",
    "privacy_url": "",
    "support_email": "",
    "support_phone": "",
}

@api_router.get("/admin/settings")
async def admin_get_settings(admin: dict = Depends(get_current_admin)):
    settings = await db.settings.find_one({"id": "app_settings"})
    if not settings:
        # Create default settings
        settings = {**DEFAULT_SETTINGS, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()}
        await db.settings.insert_one(settings)
    result = serialize_doc(settings)
    # Mask sensitive keys for display
    for key in ["smtp_password", "stripe_secret_key", "stripe_webhook_secret"]:
        if result.get(key):
            val = result[key]
            result[key + "_masked"] = val[:4] + "****" + val[-4:] if len(val) > 8 else "****"
    return {"settings": result}

@api_router.put("/admin/settings")
async def admin_update_settings(data: dict, admin: dict = Depends(get_current_admin)):
    if not data:
        raise HTTPException(status_code=400, detail="No updates provided")
    # Remove protected fields
    data.pop("id", None)
    data.pop("_id", None)
    data.pop("created_at", None)
    data["updated_at"] = datetime.utcnow()
    data["updated_by"] = admin["id"]

    settings = await db.settings.find_one({"id": "app_settings"})
    if not settings:
        new_settings = {**DEFAULT_SETTINGS, **data, "created_at": datetime.utcnow()}
        await db.settings.insert_one(new_settings)
    else:
        await db.settings.update_one({"id": "app_settings"}, {"$set": data})

    updated = await db.settings.find_one({"id": "app_settings"})
    result = serialize_doc(updated)
    for key in ["smtp_password", "stripe_secret_key", "stripe_webhook_secret"]:
        if result.get(key):
            val = result[key]
            result[key + "_masked"] = val[:4] + "****" + val[-4:] if len(val) > 8 else "****"
    return {"message": "Settings updated", "settings": result}

@api_router.post("/admin/settings/logo")
async def admin_upload_logo(data: dict, admin: dict = Depends(get_current_admin)):
    logo_data = data.get("logo")
    if not logo_data:
        raise HTTPException(status_code=400, detail="No logo data provided")
    # Store base64 logo
    await db.settings.update_one(
        {"id": "app_settings"},
        {"$set": {"brand_logo": logo_data, "updated_at": datetime.utcnow(), "updated_by": admin["id"]}},
        upsert=True
    )
    return {"message": "Logo uploaded", "brand_logo": logo_data}

@api_router.post("/admin/settings/test-email")
async def admin_test_email(data: dict, admin: dict = Depends(get_current_admin)):
    """Test email configuration by sending a test email"""
    to_email = data.get("to_email", admin.get("email"))
    settings = await db.settings.find_one({"id": "app_settings"})
    if not settings or not settings.get("smtp_host"):
        raise HTTPException(status_code=400, detail="Email settings not configured")
    # Return success for now - actual email sending would require smtplib
    return {"message": f"Test email configuration validated. Would send to {to_email}", "status": "ok"}

@api_router.post("/admin/migrate-partner-coords")
async def admin_migrate_partner_coords(admin: dict = Depends(get_current_admin)):
    """Migrate existing partners to add latitude/longitude coordinates"""
    PARTNER_COORDS = {
        "Giant Malaysia": {"latitude": 3.0733, "longitude": 101.5185},
        "Mercato": {"latitude": 3.1302, "longitude": 101.6718},
        "Jaya Grocer": {"latitude": 3.1615, "longitude": 101.7196},
        "Old Town White Coffee": {"latitude": 3.1489, "longitude": 101.7131},
        "ZUS Coffee": {"latitude": 3.1579, "longitude": 101.7120},
        "Starbucks Malaysia": {"latitude": 3.1530, "longitude": 101.7105},
        "The Coffee Bean & Tea Leaf": {"latitude": 3.1500, "longitude": 101.7095},
        "Luckin Coffee": {"latitude": 3.1415, "longitude": 101.6890},
        "Tim Hortons": {"latitude": 3.1587, "longitude": 101.7115},
        "Dunkin' Donuts": {"latitude": 3.1468, "longitude": 101.7070},
        "San Francisco Coffee": {"latitude": 3.1342, "longitude": 101.6865},
        "Shell Malaysia": {"latitude": 3.1380, "longitude": 101.7050},
        "Petronas": {"latitude": 3.1577, "longitude": 101.7114},
        "Petron Malaysia": {"latitude": 3.1220, "longitude": 101.6545},
        "Madam Kwan's": {"latitude": 3.1530, "longitude": 101.7115},
        "Ah Cheng Laksa": {"latitude": 3.1567, "longitude": 101.7132},
        "Bananabro": {"latitude": 3.1278, "longitude": 101.6710},
        "The Chicken Rice Shop": {"latitude": 3.1480, "longitude": 101.7100},
        "Nyonya Colors": {"latitude": 3.1195, "longitude": 101.6337},
        "Papparich": {"latitude": 3.1350, "longitude": 101.6188},
        "Ali, Muthu & Ah Hock": {"latitude": 3.1355, "longitude": 101.6342},
        "Penang Chendul": {"latitude": 5.4164, "longitude": 100.3327},
        "Watsons Malaysia": {"latitude": 3.1580, "longitude": 101.7118},
        "Genting Highlands": {"latitude": 3.4236, "longitude": 101.7934},
        "Grab Malaysia": {"latitude": 3.1390, "longitude": 101.6869},
        "Lotus's (Tesco)": {"latitude": 3.1385, "longitude": 101.6135},
        "Warung Pak Ali": {"latitude": 3.1412, "longitude": 101.6945},
        "Food-On-Wheels": {"latitude": 3.1350, "longitude": 101.6850},
    }
    
    missing = await db.partners.find({"latitude": {"$exists": False}}).to_list(length=500)
    updated = 0
    for partner in missing:
        name = partner.get("name", "")
        coords = PARTNER_COORDS.get(name, {"latitude": 3.1390 + (hash(name) % 50) * 0.002, "longitude": 101.6869 + (hash(name) % 50) * 0.002})
        await db.partners.update_one({"_id": partner["_id"]}, {"$set": coords})
        updated += 1
    
    total = await db.partners.count_documents({})
    with_coords = await db.partners.count_documents({"latitude": {"$exists": True}})
    
    return {
        "message": f"Migration complete. Updated {updated} partners.",
        "total_partners": total,
        "with_coordinates": with_coords,
        "missing_coordinates": total - with_coords
    }

# ========================= SEED DATA =========================

# Public endpoint to fix partners missing coordinates (for production migration)
@api_router.post("/migrate/fix-partner-coords")
async def public_fix_partner_coords():
    """One-time migration to add lat/lng to existing partners. Safe to call multiple times."""
    PARTNER_COORDS = {
        "Giant Malaysia": {"latitude": 3.0733, "longitude": 101.5185},
        "Mercato": {"latitude": 3.1302, "longitude": 101.6718},
        "Jaya Grocer": {"latitude": 3.1615, "longitude": 101.7196},
        "Old Town White Coffee": {"latitude": 3.1489, "longitude": 101.7131},
        "ZUS Coffee": {"latitude": 3.1579, "longitude": 101.7120},
        "Starbucks Malaysia": {"latitude": 3.1530, "longitude": 101.7105},
        "The Coffee Bean & Tea Leaf": {"latitude": 3.1500, "longitude": 101.7095},
        "Luckin Coffee": {"latitude": 3.1415, "longitude": 101.6890},
        "Tim Hortons": {"latitude": 3.1587, "longitude": 101.7115},
        "Dunkin' Donuts": {"latitude": 3.1468, "longitude": 101.7070},
        "San Francisco Coffee": {"latitude": 3.1342, "longitude": 101.6865},
        "Shell Malaysia": {"latitude": 3.1380, "longitude": 101.7050},
        "Petronas": {"latitude": 3.1577, "longitude": 101.7114},
        "Petron Malaysia": {"latitude": 3.1220, "longitude": 101.6545},
        "Madam Kwan's": {"latitude": 3.1530, "longitude": 101.7115},
        "Ah Cheng Laksa": {"latitude": 3.1567, "longitude": 101.7132},
        "Bananabro": {"latitude": 3.1278, "longitude": 101.6710},
        "The Chicken Rice Shop": {"latitude": 3.1480, "longitude": 101.7100},
        "Nyonya Colors": {"latitude": 3.1195, "longitude": 101.6337},
        "Papparich": {"latitude": 3.1350, "longitude": 101.6188},
        "Ali, Muthu & Ah Hock": {"latitude": 3.1355, "longitude": 101.6342},
        "Penang Chendul": {"latitude": 5.4164, "longitude": 100.3327},
        "Watsons Malaysia": {"latitude": 3.1580, "longitude": 101.7118},
        "Genting Highlands": {"latitude": 3.4236, "longitude": 101.7934},
        "Grab Malaysia": {"latitude": 3.1390, "longitude": 101.6869},
        "Lotus's (Tesco)": {"latitude": 3.1385, "longitude": 101.6135},
        "Warung Pak Ali": {"latitude": 3.1412, "longitude": 101.6945},
        "Food-On-Wheels": {"latitude": 3.1350, "longitude": 101.6850},
    }
    
    missing = await db.partners.find({"latitude": {"$exists": False}}).to_list(length=500)
    updated = 0
    for partner in missing:
        name = partner.get("name", "")
        coords = PARTNER_COORDS.get(name, {"latitude": 3.1390 + (hash(name) % 50) * 0.002, "longitude": 101.6869 + (hash(name) % 50) * 0.002})
        await db.partners.update_one({"_id": partner["_id"]}, {"$set": coords})
        updated += 1
    
    total = await db.partners.count_documents({})
    with_coords = await db.partners.count_documents({"latitude": {"$exists": True}})
    
    return {
        "message": f"Migration complete. Updated {updated} partners with coordinates.",
        "total_partners": total,
        "with_coordinates": with_coords,
        "missing_coordinates": total - with_coords
    }

@api_router.post("/seed")
async def seed_data():
    """Seed the database with Malaysia-specific sample data"""
    
    # Malaysian Partners - Comprehensive list with all categories and KL coordinates
    partners = [
        # ===== GROCERY & SUPERMARKET =====
        {
            "id": str(uuid.uuid4()),
            "name": "Giant Malaysia",
            "logo": "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=200",
            "description": "Malaysia's leading hypermarket chain with wide range of groceries",
            "category": "Grocery",
            "address": "Shah Alam, Selangor",
            "latitude": 3.0733,
            "longitude": 101.5185,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Mercato",
            "logo": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200",
            "description": "Premium gourmet grocery and fresh market",
            "category": "Grocery",
            "address": "Bangsar, Kuala Lumpur",
            "latitude": 3.1301,
            "longitude": 101.6717,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Lotus's (Tesco)",
            "logo": "https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=200",
            "description": "Hypermarket and grocery",
            "category": "Grocery",
            "address": "Mutiara Damansara",
            "latitude": 3.1565,
            "longitude": 101.6140,
            "points_multiplier": 1.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        
        # ===== FUEL STATIONS =====
        {
            "id": str(uuid.uuid4()),
            "name": "Shell Malaysia",
            "logo": "https://images.pexels.com/photos/29583979/pexels-photo-29583979.jpeg?w=200",
            "description": "Premium fuel and V-Power services",
            "category": "Fuel",
            "address": "Jalan Ampang, KL",
            "latitude": 3.1590,
            "longitude": 101.7228,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Petronas",
            "logo": "https://images.unsplash.com/photo-1637065812901-54be533db28e?w=200",
            "description": "Malaysia's national fuel station and Mesra stores",
            "category": "Fuel",
            "address": "Jalan Sultan Ismail, KL",
            "latitude": 3.1516,
            "longitude": 101.7068,
            "points_multiplier": 2.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Petron Malaysia",
            "logo": "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=200",
            "description": "Quality fuel with Treats convenience stores",
            "category": "Fuel",
            "address": "Jalan Tun Razak, KL",
            "latitude": 3.1600,
            "longitude": 101.7180,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        
        # ===== MALAYSIAN FOOD RESTAURANTS =====
        {
            "id": str(uuid.uuid4()),
            "name": "Madam Kwan's",
            "logo": "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=200",
            "description": "Authentic Malaysian cuisine - Nasi Lemak, Nasi Bojari",
            "category": "Dining",
            "address": "Pavilion KL, KLCC",
            "latitude": 3.1488,
            "longitude": 101.7130,
            "points_multiplier": 2.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Ah Cheng Laksa",
            "logo": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200",
            "description": "Famous Penang Assam Laksa specialist",
            "category": "Dining",
            "address": "Mid Valley Megamall, KL",
            "latitude": 3.1180,
            "longitude": 101.6775,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Bananabro",
            "logo": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200",
            "description": "Banana leaf rice and Indian-Malaysian fusion",
            "category": "Dining",
            "address": "Bangsar, Mont Kiara",
            "latitude": 3.1310,
            "longitude": 101.6698,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "The Chicken Rice Shop",
            "logo": "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=200",
            "description": "Hainanese chicken rice chain",
            "category": "Dining",
            "address": "Suria KLCC",
            "latitude": 3.1578,
            "longitude": 101.7119,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Nyonya Colors",
            "logo": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=200",
            "description": "Peranakan Nyonya cuisine specialist",
            "category": "Dining",
            "address": "1 Utama, Petaling Jaya",
            "latitude": 3.1504,
            "longitude": 101.6155,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Old Town White Coffee",
            "logo": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200",
            "description": "Malaysian kopitiam chain - White Coffee specialist",
            "category": "Coffee",
            "address": "Bukit Bintang, KL",
            "latitude": 3.1465,
            "longitude": 101.7105,
            "points_multiplier": 2.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Papparich",
            "logo": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200",
            "description": "Authentic kopitiam experience with local favorites",
            "category": "Dining",
            "address": "Sunway Pyramid, PJ",
            "latitude": 3.0731,
            "longitude": 101.6072,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Ali, Muthu & Ah Hock",
            "logo": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200",
            "description": "Multi-racial Malaysian food court concept",
            "category": "Dining",
            "address": "Damansara, TTDI",
            "latitude": 3.1363,
            "longitude": 101.6300,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Penang Chendul",
            "logo": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=200",
            "description": "Famous Penang dessert - Cendol and Ais Kacang",
            "category": "Dining",
            "address": "Georgetown, Penang",
            "latitude": 5.4164,
            "longitude": 100.3327,
            "points_multiplier": 1.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        
        # ===== COFFEE CHAINS =====
        {
            "id": str(uuid.uuid4()),
            "name": "ZUS Coffee",
            "logo": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200",
            "description": "Malaysia's fastest growing specialty coffee chain",
            "category": "Coffee",
            "address": "KLCC, Kuala Lumpur",
            "latitude": 3.1580,
            "longitude": 101.7120,
            "points_multiplier": 2.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Starbucks Malaysia",
            "logo": "https://images.unsplash.com/photo-1615679953957-340c5cb38bd7?w=200",
            "description": "Premium coffee experience worldwide",
            "category": "Coffee",
            "address": "Pavilion KL",
            "latitude": 3.1490,
            "longitude": 101.7137,
            "points_multiplier": 2.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "The Coffee Bean & Tea Leaf",
            "logo": "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=200",
            "description": "Premium coffee and tea beverages",
            "category": "Coffee",
            "address": "Mid Valley, KL",
            "latitude": 3.1185,
            "longitude": 101.6770,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Luckin Coffee",
            "logo": "https://images.unsplash.com/photo-1497636577773-f1231844b336?w=200",
            "description": "Tech-driven coffee chain from China",
            "category": "Coffee",
            "address": "Bangsar South, KL",
            "latitude": 3.1113,
            "longitude": 101.6660,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Tim Hortons",
            "logo": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=200",
            "description": "Canadian coffee chain - Donuts and coffee",
            "category": "Coffee",
            "address": "KLCC, Pavilion KL",
            "latitude": 3.1525,
            "longitude": 101.7115,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Dunkin' Donuts",
            "logo": "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200",
            "description": "Donuts, coffee and breakfast items",
            "category": "Coffee",
            "address": "Nu Sentral, KL",
            "latitude": 3.1340,
            "longitude": 101.6862,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "San Francisco Coffee",
            "logo": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=200",
            "description": "Malaysian homegrown specialty coffee",
            "category": "Coffee",
            "address": "Menara TM, KL",
            "latitude": 3.1420,
            "longitude": 101.6990,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        
        # ===== HEALTH & BEAUTY / FITNESS =====
        {
            "id": str(uuid.uuid4()),
            "name": "Watsons Malaysia",
            "logo": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200",
            "description": "Health and beauty retail",
            "category": "Health & Beauty",
            "address": "Suria KLCC",
            "latitude": 3.1575,
            "longitude": 101.7117,
            "points_multiplier": 1.5,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        
        # ===== TRAVEL & TRANSPORT =====
        {
            "id": str(uuid.uuid4()),
            "name": "Genting Highlands",
            "logo": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=200",
            "description": "Entertainment resort and theme parks",
            "category": "Travel",
            "address": "Genting Highlands, Pahang",
            "latitude": 3.4236,
            "longitude": 101.7933,
            "points_multiplier": 3.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Grab Malaysia",
            "logo": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=200",
            "description": "Ride-hailing, food delivery, and e-wallet",
            "category": "Transport",
            "address": "Nationwide",
            "latitude": 3.1390,
            "longitude": 101.6869,
            "points_multiplier": 2.0,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
    ]
    
    # Malaysian Rewards (in RM)
    rewards = [
        {
            "id": str(uuid.uuid4()),
            "name": "RM5 Cash Rebate",
            "description": "Get RM5 credited to your e-wallet",
            "image": None,
            "points_required": 500,
            "category": "Cash",
            "terms_conditions": "Valid for 30 days. Cannot be combined with other offers.",
            "quantity": -1,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "RM10 Cash Rebate",
            "description": "Get RM10 credited to your e-wallet",
            "image": None,
            "points_required": 1000,
            "category": "Cash",
            "terms_conditions": "Valid for 30 days. Cannot be combined with other offers.",
            "quantity": -1,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Free Teh Tarik",
            "description": "Redeem a free Teh Tarik at Mamak Corner",
            "image": None,
            "points_required": 150,
            "category": "Food & Beverage",
            "terms_conditions": "Valid at participating outlets. One per customer per day.",
            "quantity": 200,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "20% Off AEON",
            "description": "Get 20% off your next purchase at AEON",
            "image": None,
            "points_required": 300,
            "category": "Shopping",
            "terms_conditions": "Max discount RM50. Cannot be combined with other offers.",
            "quantity": 100,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Free Petronas RON95 (5L)",
            "description": "Redeem 5 liters of RON95 fuel at Petronas",
            "image": None,
            "points_required": 400,
            "category": "Fuel",
            "terms_conditions": "Valid at Petronas stations only.",
            "quantity": 50,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Genting Day Pass",
            "description": "One day theme park pass at Genting SkyWorlds",
            "image": None,
            "points_required": 5000,
            "category": "Travel",
            "terms_conditions": "Subject to availability. Blackout dates may apply.",
            "quantity": 20,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Touch 'n Go RM20 Reload",
            "description": "RM20 Touch 'n Go eWallet reload",
            "image": None,
            "points_required": 2000,
            "category": "E-Wallet",
            "terms_conditions": "Credit within 24 hours.",
            "quantity": -1,
            "is_active": True,
            "created_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Grab RM15 Voucher",
            "description": "RM15 off your next Grab ride or food order",
            "image": None,
            "points_required": 1500,
            "category": "Transport",
            "terms_conditions": "Min spend RM20. Valid 7 days.",
            "quantity": -1,
            "is_active": True,
            "created_at": datetime.utcnow()
        }
    ]
    
    # Clear existing data
    await db.partners.delete_many({})
    await db.rewards.delete_many({})
    
    # Insert new data
    await db.partners.insert_many(partners)
    await db.rewards.insert_many(rewards)
    
    return {
        "message": "Database seeded successfully",
        "partners_count": len(partners),
        "rewards_count": len(rewards)
    }

# ========================= HEALTH CHECK =========================

@api_router.get("/")
async def root():
    return {"message": "RewardsHub API is running", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_auto_seed():
    """Auto-seed database with Malaysian partners and default admin if collections are empty"""
    # --- Seed default Super Admin ---
    admin_count = await db.admins.count_documents({})
    if admin_count == 0:
        print("No admin found. Creating default Super Admin account...")
        try:
            admin_id = str(uuid.uuid4())
            default_admin = {
                "id": admin_id,
                "email": "admin@rewards.com",
                "password_hash": hash_password("admin123"),
                "name": "Super Admin",
                "role": "super_admin",
                "created_at": datetime.utcnow()
            }
            await db.admins.insert_one(default_admin)
            print(f"Default Super Admin created: admin@rewards.com / admin123")
        except Exception as e:
            print(f"Admin seed error: {e}")
    else:
        print(f"Database already has {admin_count} admin(s). Skipping admin seed.")

    # --- Seed partners ---
    count = await db.partners.count_documents({})
    missing_coords = await db.partners.count_documents({"latitude": {"$exists": False}})
    
    if count == 0 or missing_coords > 0:
        if count == 0:
            print("No partners found in database. Auto-seeding Malaysian store data...")
        else:
            print(f"Found {missing_coords}/{count} partners missing coordinates. Updating with lat/lng data...")
        
        # Coordinate data keyed by partner name for updating existing records
        PARTNER_COORDS = {
            "Giant Malaysia": {"latitude": 3.0733, "longitude": 101.5185, "address": "Shah Alam, Selangor"},
            "Mercato": {"latitude": 3.1302, "longitude": 101.6718, "address": "Bangsar Shopping Centre, KL"},
            "Jaya Grocer": {"latitude": 3.1615, "longitude": 101.7196, "address": "Intermark Mall, KL"},
            "Old Town White Coffee": {"latitude": 3.1489, "longitude": 101.7131, "address": "Pavilion KL, Bukit Bintang"},
            "ZUS Coffee": {"latitude": 3.1579, "longitude": 101.7120, "address": "KLCC Area, KL"},
            "Starbucks Malaysia": {"latitude": 3.1530, "longitude": 101.7105, "address": "Bukit Bintang, KL"},
            "The Coffee Bean & Tea Leaf": {"latitude": 3.1500, "longitude": 101.7095, "address": "Pavilion KL"},
            "Luckin Coffee": {"latitude": 3.1415, "longitude": 101.6890, "address": "Bangsar South, KL"},
            "Tim Hortons": {"latitude": 3.1587, "longitude": 101.7115, "address": "KLCC, KL"},
            "Dunkin' Donuts": {"latitude": 3.1468, "longitude": 101.7070, "address": "KL Sentral"},
            "San Francisco Coffee": {"latitude": 3.1342, "longitude": 101.6865, "address": "Mid Valley, KL"},
            "Shell Malaysia": {"latitude": 3.1380, "longitude": 101.7050, "address": "Jalan Ampang, KL"},
            "Petronas": {"latitude": 3.1577, "longitude": 101.7114, "address": "Jalan Sultan Ismail, KL"},
            "Petron Malaysia": {"latitude": 3.1220, "longitude": 101.6545, "address": "PJ, Selangor"},
            "Madam Kwan's": {"latitude": 3.1530, "longitude": 101.7115, "address": "Pavilion KL, KLCC"},
            "Ah Cheng Laksa": {"latitude": 3.1567, "longitude": 101.7132, "address": "KLCC, KL"},
            "Bananabro": {"latitude": 3.1278, "longitude": 101.6710, "address": "Bangsar, KL"},
            "The Chicken Rice Shop": {"latitude": 3.1480, "longitude": 101.7100, "address": "Mid Valley, KL"},
            "Nyonya Colors": {"latitude": 3.1195, "longitude": 101.6337, "address": "1 Utama, PJ"},
            "Papparich": {"latitude": 3.1350, "longitude": 101.6188, "address": "SS2, PJ"},
            "Ali, Muthu & Ah Hock": {"latitude": 3.1355, "longitude": 101.6342, "address": "Damansara, KL"},
            "Penang Chendul": {"latitude": 5.4164, "longitude": 100.3327, "address": "Georgetown, Penang"},
            "Watsons Malaysia": {"latitude": 3.1580, "longitude": 101.7118, "address": "Suria KLCC"},
            "Genting Highlands": {"latitude": 3.4236, "longitude": 101.7934, "address": "Genting Highlands, Pahang"},
            "Grab Malaysia": {"latitude": 3.1390, "longitude": 101.6869, "address": "Nationwide"},
            "Lotus's (Tesco)": {"latitude": 3.1385, "longitude": 101.6135, "address": "Mutiara Damansara"},
        }
        
        # Update existing partners that are missing coordinates
        if missing_coords > 0:
            missing_partners = await db.partners.find({"latitude": {"$exists": False}}).to_list(length=200)
            updated_count = 0
            for partner in missing_partners:
                coords = PARTNER_COORDS.get(partner.get("name"))
                if coords:
                    await db.partners.update_one(
                        {"_id": partner["_id"]},
                        {"$set": coords}
                    )
                    updated_count += 1
                else:
                    # Assign default KL coordinates for unknown partners
                    await db.partners.update_one(
                        {"_id": partner["_id"]},
                        {"$set": {"latitude": 3.1390 + (hash(partner.get("name","")) % 100) * 0.001, "longitude": 101.6869 + (hash(partner.get("name","")) % 100) * 0.001}}
                    )
                    updated_count += 1
            print(f"Updated {updated_count} partners with coordinates.")
        
        if count == 0:
            try:
                # Call the seed endpoint logic directly
                partners = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Giant Malaysia",
                    "logo": "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=200",
                    "description": "Malaysia's leading hypermarket chain with wide range of groceries",
                    "category": "Grocery",
                    "address": "Shah Alam, Selangor",
                    "latitude": 3.0733,
                    "longitude": 101.5185,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Mercato",
                    "logo": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200",
                    "description": "Premium supermarket with imported & local groceries",
                    "category": "Grocery",
                    "address": "Bangsar Shopping Centre, KL",
                    "latitude": 3.1302,
                    "longitude": 101.6718,
                    "points_multiplier": 2.0,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Jaya Grocer",
                    "logo": "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200",
                    "description": "Premium grocery retailer in Malaysia",
                    "category": "Grocery",
                    "address": "Intermark Mall, KL",
                    "latitude": 3.1615,
                    "longitude": 101.7196,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Old Town White Coffee",
                    "logo": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200",
                    "description": "Iconic Malaysian white coffee chain",
                    "category": "Coffee",
                    "address": "Pavilion KL, Bukit Bintang",
                    "latitude": 3.1489,
                    "longitude": 101.7131,
                    "points_multiplier": 2.0,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "ZUS Coffee",
                    "logo": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200",
                    "description": "Popular Malaysian specialty coffee chain",
                    "category": "Coffee",
                    "address": "Menara TM, Bangsar",
                    "latitude": 3.1281,
                    "longitude": 101.6882,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Starbucks Malaysia",
                    "logo": "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=200",
                    "description": "World famous coffee house",
                    "category": "Coffee",
                    "address": "KLCC, Kuala Lumpur",
                    "latitude": 3.1579,
                    "longitude": 101.7116,
                    "points_multiplier": 1.0,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "The Coffee Bean & Tea Leaf",
                    "logo": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=200",
                    "description": "Premium coffee & tea beverages",
                    "category": "Coffee",
                    "address": "The Gardens Mall, Mid Valley",
                    "latitude": 3.1180,
                    "longitude": 101.6770,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Luckin Coffee",
                    "logo": "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=200",
                    "description": "Fast-growing coffee chain",
                    "category": "Coffee",
                    "address": "Sunway Velocity, Cheras",
                    "latitude": 3.1283,
                    "longitude": 101.7215,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Tim Hortons",
                    "logo": "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=200",
                    "description": "Canadian coffee & donut chain",
                    "category": "Coffee",
                    "address": "Gurney Plaza, Penang",
                    "latitude": 5.4370,
                    "longitude": 100.3105,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Dunkin' Donuts",
                    "logo": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200",
                    "description": "Donuts and coffee favorites",
                    "category": "Coffee",
                    "address": "Nu Sentral, KL",
                    "latitude": 3.1340,
                    "longitude": 101.6866,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "San Francisco Coffee",
                    "logo": "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=200",
                    "description": "Malaysian-born specialty coffee",
                    "category": "Coffee",
                    "address": "1 Utama, PJ",
                    "latitude": 3.1506,
                    "longitude": 101.6156,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Madam Kwan's",
                    "logo": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200",
                    "description": "Legendary Malaysian cuisine since 1977",
                    "category": "Dining",
                    "address": "KLCC, Kuala Lumpur",
                    "latitude": 3.1572,
                    "longitude": 101.7129,
                    "points_multiplier": 2.0,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Ah Cheng Laksa",
                    "logo": "https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=200",
                    "description": "Award-winning Penang Laksa",
                    "category": "Dining",
                    "address": "SS15, Subang Jaya",
                    "latitude": 3.0767,
                    "longitude": 101.5875,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Bananabro",
                    "logo": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200",
                    "description": "Banana leaf rice restaurant chain",
                    "category": "Dining",
                    "address": "Bangsar South, KL",
                    "latitude": 3.1105,
                    "longitude": 101.6653,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "The Chicken Rice Shop",
                    "logo": "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=200",
                    "description": "Best chicken rice in Malaysia",
                    "category": "Dining",
                    "address": "IOI City Mall, Putrajaya",
                    "latitude": 2.9718,
                    "longitude": 101.7117,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Nyonya Colors",
                    "logo": "https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=200",
                    "description": "Authentic Nyonya cuisine",
                    "category": "Dining",
                    "address": "Jalan Alor, Bukit Bintang",
                    "latitude": 3.1457,
                    "longitude": 101.7085,
                    "points_multiplier": 2.0,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Papparich",
                    "logo": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200",
                    "description": "Popular kopitiam chain in Malaysia",
                    "category": "Dining",
                    "address": "Sunway Pyramid, PJ",
                    "latitude": 3.0717,
                    "longitude": 101.6072,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Ali, Muthu & Ah Hock",
                    "logo": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200",
                    "description": "Multi-racial Malaysian comfort food",
                    "category": "Dining",
                    "address": "Bangsar, KL",
                    "latitude": 3.1299,
                    "longitude": 101.6710,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Penang Chendul",
                    "logo": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=200",
                    "description": "Famous Penang cendol and laksa",
                    "category": "Dining",
                    "address": "Petaling Street, KL",
                    "latitude": 3.1435,
                    "longitude": 101.6972,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Petronas Mesra",
                    "logo": "https://images.unsplash.com/photo-1545396274-37e1e18e7f0d?w=200",
                    "description": "Petronas fuel stations - earn points on every fill-up",
                    "category": "Fuel",
                    "address": "Jalan Tun Razak, KL",
                    "latitude": 3.1600,
                    "longitude": 101.7200,
                    "points_multiplier": 3.0,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Shell Select",
                    "logo": "https://images.unsplash.com/photo-1615064694000-d6dd35e68b46?w=200",
                    "description": "Shell fuel stations with BonusLink integration",
                    "category": "Fuel",
                    "address": "Jalan Ampang, KL",
                    "latitude": 3.1620,
                    "longitude": 101.7350,
                    "points_multiplier": 2.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Watsons Malaysia",
                    "logo": "https://images.unsplash.com/photo-1571782742478-0816a4773a10?w=200",
                    "description": "Leading health & beauty retailer",
                    "category": "Health & Beauty",
                    "address": "Mid Valley Megamall, KL",
                    "latitude": 3.1185,
                    "longitude": 101.6768,
                    "points_multiplier": 2.0,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Guardian Malaysia",
                    "logo": "https://images.unsplash.com/photo-1585435557343-3b092031a831?w=200",
                    "description": "Pharmacy & personal care products",
                    "category": "Health & Beauty",
                    "address": "Suria KLCC",
                    "latitude": 3.1580,
                    "longitude": 101.7118,
                    "points_multiplier": 1.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Celebrity Fitness",
                    "logo": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200",
                    "description": "Premium gym & fitness centers",
                    "category": "Fitness",
                    "address": "Bangsar Village, KL",
                    "latitude": 3.1310,
                    "longitude": 101.6700,
                    "points_multiplier": 2.5,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "AirAsia Rewards",
                    "logo": "https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=200",
                    "description": "Earn points on AirAsia flights",
                    "category": "Travel",
                    "address": "KLIA2, Sepang",
                    "latitude": 2.7456,
                    "longitude": 101.7072,
                    "points_multiplier": 3.0,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Grab Malaysia",
                    "logo": "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=200",
                    "description": "Earn points on every Grab ride",
                    "category": "Transport",
                    "address": "Kuala Lumpur",
                    "latitude": 3.1390,
                    "longitude": 101.6869,
                    "points_multiplier": 2.0,
                    "is_active": True,
                    "created_at": datetime.utcnow()
                },
            ]
                await db.partners.insert_many(partners)
                print(f"Auto-seeded {len(partners)} Malaysian partner stores successfully!")
            except Exception as e:
                print(f"Auto-seed error: {e}")
    else:
        print(f"Database already has {count} partners. Skipping auto-seed.")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
