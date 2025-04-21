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
    if 10 < len(q) < 100:
        return web.json_response({"error": "Fuck you scraper"}, status=400)

    user_c = request.app[mongo]["users"]
    question_c = request.app[mongo]["question"]

    old_user = await user_c.find_one({"t": t})
    if old_user is None:
        await user_c.insert_one({"t": t, "ips": []})
        old_user = await user_c.find_one({"t": t})

    if request.remote not in old_user["ips"]:
        await user_c.update_one({"t": t}, {"$push": {"ips": request.remote}})
    await user_c.update_one({"t": d}, {"$set": {"device": d}})

    await question_c.insert_one({
        "t": t,
        "question": q,
        "time": datetime.datetime.utcnow()
    })
    return web.json_response({})


routes.static('/static', "./static")


async def db_context(app: web.Application) -> AsyncIterator[None]:
    uri = os.environ.get("MONGO_URI")
    client = AsyncIOMotorClient(uri, server_api=ServerApi('1'))["STALK_QnA"]
    app[mongo] = client
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
