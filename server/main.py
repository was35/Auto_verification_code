from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional
import json
import uvicorn
import os
from pydantic import BaseModel
from sqlalchemy.orm import Session

# 导入模块
import user_routes
import admin_routes
from database import SessionLocal, User
from auth import SECRET_KEY, ALGORITHM
from jose import jwt

app = FastAPI(title="自动验证码转发服务器")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载路由
app.include_router(user_routes.router)
app.include_router(admin_routes.router)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 存储连接的 WebSocket 客户端
# 用户ID -> { 设备ID -> WebSocket }
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, user_id: str, device_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = {}
        self.active_connections[user_id][device_id] = websocket

    def disconnect(self, user_id: str, device_id: str):
        if user_id in self.active_connections:
            if device_id in self.active_connections[user_id]:
                del self.active_connections[user_id][device_id]
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user_devices(self, user_id: str, code: str, target_device: str = None):
        print(f"尝试向用户 {user_id} 发送验证码. 当前在线用户: {list(self.active_connections.keys())}")
        if user_id not in self.active_connections:
            print(f"发送失败: 用户 {user_id} 未连接 WebSocket")
            return False
        
        devices = self.active_connections[user_id]
        print(f"用户 {user_id} 的在线设备: {list(devices.keys())}")
        if not devices:
            print(f"发送失败: 用户 {user_id} 没有活动的设备连接")
            return False

        # 如果指定了设备且在线
        if target_device and target_device in devices:
            print(f"发送到指定设备: {target_device}")
            await devices[target_device].send_text(json.dumps({"type": "VERIFICATION_CODE", "code": code}))
            return True
        
        # 否则发给所有在线设备
        print(f"发送到所有在线设备 ({len(devices)}个)")
        for d_id, device_ws in devices.items():
            await device_ws.send_text(json.dumps({"type": "VERIFICATION_CODE", "code": code}))
        return True

manager = ConnectionManager()

@app.get("/")
async def root():
    return {"message": "自动验证码转发服务器正在运行"}

# 手机推送接口 - 使用 username
@app.post("/push/{username}")
async def receive_code(username: str, data: Dict, db: Session = Depends(get_db)):
    print(f"收到手机推送请求, 用户名: {username}, 数据: {data}")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        print(f"推送失败: 数据库中未找到用户 {username}")
        raise HTTPException(status_code=403, detail="无效的用户名")
    
    code = data.get("code")
    device_id = data.get("device_id") # 可选指定发送到哪个电脑
    
    if not code:
        print(f"推送失败: 请求中缺少 code 字段")
        raise HTTPException(status_code=400, detail="Code is required")
    
    # 使用数据库中的用户名（保持大小写一致性，如果DB中有的话）
    success = await manager.send_to_user_devices(user.username, code, device_id)
    
    if success:
        print(f"推送成功: 验证码已下发到 {user.username} 的设备")
        return {"status": "success", "message": "验证码已发送到浏览器"}
    else:
        print(f"推送失败: 用户 {user.username} 当前没有活动的 WebSocket 连接")
        return {"status": "error", "message": "没有连接的浏览器实例"}

# 浏览器插件 WebSocket 连接
@app.websocket("/ws/{device_id}")
async def websocket_endpoint(websocket: WebSocket, device_id: str):
    token = websocket.query_params.get("token")
    print(f"收到 WebSocket 连接请求, 设备ID: {device_id}")
    try:
        # 验证 Token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            print(f"Token 验证失败: username 为空")
            await websocket.close(code=1008)
            return
        print(f"Token 验证成功, 用户: {username}")
    except Exception as e:
        print(f"Token 验证报错: {str(e)}")
        await websocket.close(code=1008)
        return

    await manager.connect(username, device_id, websocket)
    print(f"WebSocket 已连接并进入监听循环: {username} - {device_id}")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        print(f"WebSocket 断开连接: {username} - {device_id}")
        manager.disconnect(username, device_id)
    except Exception as e:
        print(f"WebSocket 运行报错: {str(e)}")
        manager.disconnect(username, device_id)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
