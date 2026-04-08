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

class BranchCreate(BaseModel):
    name: str
    address: str
    phone: Optional[str] = None
    is_active: bool = True

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

# ========================= SEED DATA =========================

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
