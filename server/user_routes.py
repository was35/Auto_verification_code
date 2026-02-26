from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import SessionLocal, User
from auth import verify_password, get_password_hash, create_access_token
from utils import generate_api_token
from pydantic import BaseModel
import os

router = APIRouter()

# 获取数据库会话
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    # 第一个用户自动激活作为管理员
    count = db.query(User).count()
    is_active = True if count == 0 else False
    
    new_user = User(
        username=user.username,
        hashed_password=hashed_password,
        is_active=is_active,
        api_token=generate_api_token()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "注册成功，请等待管理员通过。" if not is_active else "注册及自动激活为管理员。"}

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    if not db_user.is_active:
        raise HTTPException(status_code=403, detail="账户未激活，请联系管理员。")
    
    access_token = create_access_token(data={"sub": db_user.username})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "api_token": db_user.api_token,
        "user_id": db_user.username
    }
