from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from database import SessionLocal, User
import os

router = APIRouter()

AUTH_KEY = os.getenv("AUTH_KEY", "admin123")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_admin_auth(request: Request):
    # 简单的 Cookie 验证
    token = request.cookies.get("admin_token")
    if token != AUTH_KEY:
        return False
    return True

@router.get("/admin/login", response_class=HTMLResponse)
def admin_login_page():
    with open("templates/admin_login.html", "r", encoding="utf-8") as f:
        return f.read()

@router.get("/admin", response_class=HTMLResponse)
def admin_page(request: Request, db: Session = Depends(get_db)):
    if not check_admin_auth(request):
        return RedirectResponse(url="/admin/login")
        
    users = db.query(User).all()

    user_rows = ""
    for u in users:
        status = "已激活" if u.is_active else "待审批"
        action = f'<button onclick="approve({u.id})">通过审批</button>' if not u.is_active else ""
        user_rows += f"""
        <tr>
            <td>{u.id}</td>
            <td>{u.username}</td>
            <td>{status}</td>
            <td><code>{u.api_token}</code></td>
            <td>{action}</td>
        </tr>
        """

    html = f"""
    <html>
    <head>
        <title>管理员后台</title>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: sans-serif; padding: 20px; background: #f4f4f9; }}
            table {{ border-collapse: collapse; width: 100%; background: white; }}
            th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
            th {{ background-color: #4CAF50; color: white; }}
            tr:nth-child(even) {{ background-color: #f2f2f2; }}
            button {{ background: #4CAF50; color: white; border: none; padding: 5px 10px; cursor: pointer; }}
            .header {{ display: flex; justify-content: space-between; align-items: center; }}
            .logout-btn {{ background: #f44336; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>用户管理</h1>
            <button class="logout-btn" onclick="logout()">退出登录</button>
        </div>
        <table>
            <tr><th>ID</th><th>用户名</th><th>状态</th><th>API Token</th><th>操作</th></tr>
            {user_rows}
        </table>
        <script>
            function approve(id) {{
                fetch('/admin/approve/' + id, {{method: 'POST'}})
                .then(r => r.json())
                .then(data => {{
                    alert(data.message);
                    location.reload();
                }});
            }}
            function logout() {{
                document.cookie = "admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                location.reload();
            }}
        </script>
    </body>
    </html>
    """
    return html

@router.post("/admin/approve/{user_id}")
def approve_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    if not check_admin_auth(request):
        raise HTTPException(status_code=401, detail="未授权")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.is_active = True
    db.commit()
    return {"message": f"用户 {user.username} 已通过审批！"}
