import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

setGlobalOptions({ maxInstances: 10 });

// Secrets (set via: firebase functions:secrets:set LS_WEBHOOK_SECRET)
const lsWebhookSecret = defineSecret("LS_WEBHOOK_SECRET");

// LemonSqueezy variant ID → plan tier mapping
// Set via: firebase functions:secrets:set LS_VARIANT_MAP
// Format: "variantId1:starter,variantId2:pro,variantId3:team"
const lsVariantMap = defineSecret("LS_VARIANT_MAP");

type PlanTier = "trial" | "starter" | "pro" | "team";

const PLAN_PROFILE_LIMITS: Record<PlanTier, number> = {
    trial: 3,
    starter: 10,
    pro: 100,
    team: 300,
};

// Parse variant map from secret string
function parseVariantMap(raw: string): Record<string, PlanTier> {
    const map: Record<string, PlanTier> = {};
    for (const entry of raw.split(",")) {
        const [variantId, plan] = entry.trim().split(":");
        if (variantId && plan) {
            map[variantId] = plan as PlanTier;
        }
    }
    return map;
}

// Validate HMAC-SHA256 signature from LemonSqueezy
function isValidSignature(
    payload: string,
    signature: string,
    secret: string,
): boolean {
    const hmac = crypto.createHmac("sha256", secret);
    const digest = hmac.update(payload).digest("hex");
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest),
    );
}

/**
 * LemonSqueezy Webhook Handler
 *
 * Receives subscription events and updates Firestore user profiles.
 * Events: subscription_created, subscription_updated, subscription_expired
 */
export const lemonSqueezyWebhook = onRequest(
    {
        secrets: [lsWebhookSecret, lsVariantMap],
        cors: false,
    },
    async (req, res) => {
        // Only accept POST
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }

        // Get raw body for signature validation
        const rawBody =
            typeof req.body === "string"
                ? req.body
                : JSON.stringify(req.body);

        // Validate signature
        const signature = req.headers["x-signature"] as string | undefined;
        if (!signature) {
            console.error("Missing X-Signature header");
            res.status(401).send("Missing signature");
            return;
        }

        try {
            if (!isValidSignature(rawBody, signature, lsWebhookSecret.value())) {
                console.error("Invalid webhook signature");
                res.status(401).send("Invalid signature");
                return;
            }
        } catch {
            console.error("Signature validation error");
            res.status(401).send("Signature validation failed");
            return;
        }

        // Parse body
        const body =
            typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        const eventName: string = body?.meta?.event_name;
        const customData = body?.meta?.custom_data;
        const firebaseUid: string | undefined = customData?.firebase_uid;

        if (!eventName) {
            console.error("Missing event_name in webhook payload");
            res.status(400).send("Missing event_name");
            return;
        }

        if (!firebaseUid) {
            console.error("Missing firebase_uid in custom_data", { eventName });
            res.status(400).send("Missing firebase_uid");
            return;
        }

        console.log(`Processing ${eventName} for user ${firebaseUid}`);

        const attrs = body?.data?.attributes;
        const variantId = String(attrs?.variant_id ?? "");
        const subscriptionId = Number(body?.data?.id ?? 0);
        const customerId = Number(attrs?.customer_id ?? 0);
        const status: string = attrs?.status ?? "";

        try {
            const userRef = db.collection("users").doc(firebaseUid);
            const variantMap = parseVariantMap(lsVariantMap.value());

            switch (eventName) {
                case "subscription_created":
                case "subscription_updated": {
                    const plan: PlanTier = variantMap[variantId] ?? "trial";
                    const profileLimit = PLAN_PROFILE_LIMITS[plan];

                    await userRef.update({
                        plan,
                        profileLimit,
                        subscriptionStatus: status,
                        lsCustomerId: customerId,
                        lsSubscriptionId: subscriptionId,
                        planExpiry: null, // Active subscription has no expiry
                        updatedAt: FieldValue.serverTimestamp(),
                    });

                    console.log(
                        `Updated user ${firebaseUid}: plan=${plan}, status=${status}`,
                    );
                    break;
                }

                case "subscription_expired":
                case "subscription_cancelled": {
                    // Downgrade to trial
                    await userRef.update({
                        plan: "trial",
                        profileLimit: PLAN_PROFILE_LIMITS.trial,
                        subscriptionStatus: status,
                        lsSubscriptionId: null,
                        planExpiry: null,
                        updatedAt: FieldValue.serverTimestamp(),
                    });

                    console.log(
                        `Downgraded user ${firebaseUid} to trial (${eventName})`,
                    );
                    break;
                }

                default:
                    console.log(`Unhandled event: ${eventName}`);
            }

            res.status(200).send("OK");
        } catch (err) {
            console.error(`Error processing webhook for ${firebaseUid}:`, err);
            res.status(500).send("Internal error");
        }
    },
);
