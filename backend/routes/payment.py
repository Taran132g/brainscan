from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
import os

router = APIRouter()

# TODO: Implement Stripe payments (Phase 1)
# Plan:
# - $3.99/month subscription
# - Paywall triggers after brain card is generated (user can see teaser, pays to unlock full card + matching)
# - Use Stripe Checkout (hosted page) for simplicity at MVP stage
# - Webhook: stripe/webhook → update user subscription status in DB
# - Free tier: brain card generation only
# - Paid tier: full brain card + matching access + messaging

@router.post("/payment/create-checkout")
async def create_checkout(user_id: str):
    raise HTTPException(status_code=501, detail="Stripe payments not yet implemented")


@router.post("/payment/webhook")
async def stripe_webhook(request: Request):
    raise HTTPException(status_code=501, detail="Stripe webhook not yet implemented")


@router.get("/payment/status/{user_id}")
async def subscription_status(user_id: str):
    raise HTTPException(status_code=501, detail="Stripe payments not yet implemented")
