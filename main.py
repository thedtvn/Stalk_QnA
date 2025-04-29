import os
from typing import AsyncIterator

from dotenv import load_dotenv

load_dotenv()
import datetime
from aiohttp import web
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.server_api import ServerApi

mongo = web.AppKey("db_key", AsyncIOMotorDatabase)

routes = web.RouteTableDef()

@routes.view("/")
async def index(_request: web.Request) -> web.FileResponse:
    return web.FileResponse("./index.html")


@routes.post("/api/ask")
async def ask(request: web.Request) -> web.Response:
    data = await request.json()
    req_data = ["q", "d", "t"]
    for i in req_data:
        if i not in data:
            return web.json_response({"error": "Fuck you scraper"}, status=400)
    q = data["q"].strip()
    d = data["d"]
    t = data["t"]

    if len(q) > 100:
        return web.json_response({"error": "Fuck you scraper"}, status=400)
    elif len(q) < 5:
        return web.json_response({"error": "Fuck you scraper"}, status=400)


    user_c = request.app[mongo]["users"]
    question_c = request.app[mongo]["question"]

    old_user = await user_c.find_one({"t": t})
    if old_user is None:
        await user_c.insert_one({"t": t, "ips": []})
        old_user = await user_c.find_one({"t": t})

    if request.remote not in old_user["ips"]:
        await user_c.update_one({"t": t}, {"$push": {"ips": request.remote}})
    await user_c.update_one({"t": t}, {"$set": {"device": d}})
    qid = os.urandom(8).hex()
    await question_c.insert_one({
        "id": qid,
        "t": t,
        "question": q,
        "time": datetime.datetime.utcnow()
    })

    await send_discord_webhook(q, d, t, request.remote, qid)

    return web.json_response({})

routes.static('/static', "./static")

import aiohttp

async def send_discord_webhook(question: str, device: str, token: str, ip: str, qid: str):
    webhook_url = os.getenv("DISCORD_WEBHOOK")
    embed = {
        "author": {
            "name": qid
        },
        "title": "New Question Received",
        "description": question,
        "fields": [
            {"name": k, "value": str(v) or "Không biết", "inline": False} for k, v in device.items()
        ],
        "footer": {
            "text": token[:16] + " | " + ip,
        }
    }
    payload = {
        "content": question,
        "embeds": [embed]
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(webhook_url, json=payload) as response:
            if response.status != 204:
                print(f"Failed to send webhook: {response.status}")

async def db_context(app: web.Application) -> AsyncIterator[None]:
    uri = os.environ.get("MONGO_URI")
    client = AsyncIOMotorClient(uri, server_api=ServerApi('1'))
    app[mongo] = client["STALK_QnA"]
    yield
    client.close()

@web.middleware
async def proxy_middleware(request: web.Request, handler):
    real_ip = request.headers.get("Cf-Connecting-Ip", request.remote) # Cloudflare header
    try:
        return await handler(request.clone(remote=real_ip))
    except web.HTTPNotFound:
        return web.HTTPFound("/")


app = web.Application()
app.middlewares.append(proxy_middleware)
app.add_routes(routes)
app.cleanup_ctx.append(db_context)
web.run_app(app, port=int(os.getenv("PORT")))
