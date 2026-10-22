#!/usr/bin/env python3
import json
import os
import sys
import uuid
from datetime import datetime
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "trip_data.json")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

lock = threading.Lock()

# Initial seed data for Kolkata Night Riders
DEFAULT_DATA = {
    "tripName": "Kolkata Night Riders 🚖🌙",
    "currency": "₹",
    "members": [
        {"id": "mem_1", "name": "Bala", "color": "#046A38"},
        {"id": "mem_2", "name": "Member 2", "color": "#E34222"},
        {"id": "mem_3", "name": "Member 3", "color": "#046A38"},
        {"id": "mem_4", "name": "Member 4", "color": "#E34222"},
        {"id": "mem_5", "name": "Member 5", "color": "#046A38"},
        {"id": "mem_6", "name": "Member 6", "color": "#E34222"}
    ],
    "expenses": []
}

AVATAR_COLORS = [
    "#6366F1", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#06B6D4", "#F43F5E", "#3B82F6"
]

def load_data():
    if not os.path.exists(DATA_FILE):
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        save_data(DEFAULT_DATA)
        return DEFAULT_DATA
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading data: {e}", file=sys.stderr)
        return DEFAULT_DATA

def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    temp_file = DATA_FILE + ".tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(temp_file, DATA_FILE)

def calculate_analytics(data):
    members = data.get("members", [])
    expenses = data.get("expenses", [])
    
    # Track paid totals and owed totals
    paid_totals = {m["id"]: 0.0 for m in members}
    owed_totals = {m["id"]: 0.0 for m in members}
    category_totals = {}
    total_spent = 0.0

    for exp in expenses:
        payer = exp.get("paidBy")
        amount = float(exp.get("amount", 0))
        cat = exp.get("category", "General")
        
        category_totals[cat] = category_totals.get(cat, 0.0) + amount
        total_spent += amount
        
        if payer in paid_totals:
            paid_totals[payer] += amount
        
        split_type = exp.get("splitType", "equal")
        split_with = exp.get("splitBetween", [])
        custom_splits = exp.get("customSplits", {})

        if split_type == "custom" and custom_splits:
            for m_id, custom_val in custom_splits.items():
                if m_id in owed_totals:
                    owed_totals[m_id] += float(custom_val)
        else:
            if split_with:
                share = amount / len(split_with)
                for m_id in split_with:
                    if m_id in owed_totals:
                        owed_totals[m_id] += share

    # Net Balances: Positive = Group owes them (Creditor); Negative = They owe group (Debtor)
    net_balances = {}
    member_stats = []
    for m in members:
        m_id = m["id"]
        paid = round(paid_totals.get(m_id, 0.0), 2)
        owed = round(owed_totals.get(m_id, 0.0), 2)
        balance = round(paid - owed, 2)
        net_balances[m_id] = balance
        member_stats.append({
            "id": m_id,
            "name": m["name"],
            "color": m.get("color", "#046A38"),
            "paid": paid,
            "owed": owed,
            "balance": balance
        })

    # Debt Simplification / Settlement Algorithm (Greedy minimum cash-flow)
    creditors = []
    debtors = []
    for m_id, bal in net_balances.items():
        if bal > 0.01:
            creditors.append([m_id, bal])
        elif bal < -0.01:
            debtors.append([m_id, -bal])

    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)

    settlements = []
    c_idx, d_idx = 0, 0
    members_map = {m["id"]: m["name"] for m in members}
    members_upi_map = {m["id"]: m.get("upi", "") for m in members}

    while c_idx < len(creditors) and d_idx < len(debtors):
        c_id, c_amt = creditors[c_idx]
        d_id, d_amt = debtors[d_idx]

        settled = min(c_amt, d_amt)
        if settled > 0.01:
            settlements.append({
                "fromId": d_id,
                "fromName": members_map.get(d_id, "Unknown"),
                "toId": c_id,
                "toName": members_map.get(c_id, "Unknown"),
                "toUpi": members_upi_map.get(c_id, ""),
                "amount": round(settled, 2)
            })

        creditors[c_idx][1] -= settled
        debtors[d_idx][1] -= settled

        if creditors[c_idx][1] < 0.01:
            c_idx += 1
        if debtors[d_idx][1] < 0.01:
            d_idx += 1

    return {
        "totalSpent": round(total_spent, 2),
        "memberStats": member_stats,
        "settlements": settlements,
        "categoryTotals": {k: round(v, 2) for k, v in category_totals.items()}
    }

class TripSplitterHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def _send_json(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/data":
            with lock:
                data = load_data()
                analytics = calculate_analytics(data)
                response_data = {
                    "tripName": data.get("tripName", "Kolkata Night Riders 🚖🌙"),
                    "currency": data.get("currency", "₹"),
                    "members": data.get("members", []),
                    "expenses": data.get("expenses", []),
                    "analytics": analytics
                }
            self._send_json(200, response_data)
            return

        # Fallback to serving static files from public/
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            body = json.loads(raw_body)
        except Exception:
            body = {}

        if path == "/api/members":
            name = body.get("name", "").strip()
            upi = body.get("upi", "").strip()
            if not name:
                self._send_json(400, {"error": "Member name is required"})
                return

            with lock:
                data = load_data()
                color = AVATAR_COLORS[len(data["members"]) % len(AVATAR_COLORS)]
                new_member = {
                    "id": "mem_" + uuid.uuid4().hex[:8],
                    "name": name,
                    "color": color,
                    "upi": upi
                }
                data["members"].append(new_member)
                save_data(data)
                analytics = calculate_analytics(data)
                self._send_json(201, {
                    "success": True,
                    "member": new_member,
                    "members": data["members"],
                    "analytics": analytics
                })
            return

        if path == "/api/expenses":
            title = body.get("title", "").strip()
            amount = float(body.get("amount", 0))
            paid_by = body.get("paidBy", "").strip()
            split_between = body.get("splitBetween", [])
            split_type = body.get("splitType", "equal")
            custom_splits = body.get("customSplits", {})
            category = body.get("category", "General")
            date_val = body.get("date", datetime.now().strftime("%Y-%m-%d"))

            if not title or amount <= 0 or not paid_by or not split_between:
                self._send_json(400, {"error": "Invalid expense details. Check title, amount, payer and split."})
                return

            with lock:
                data = load_data()
                new_expense = {
                    "id": "exp_" + uuid.uuid4().hex[:8],
                    "title": title,
                    "amount": round(amount, 2),
                    "paidBy": paid_by,
                    "splitBetween": split_between,
                    "splitType": split_type,
                    "customSplits": custom_splits,
                    "category": category,
                    "date": date_val,
                    "createdAt": datetime.now().isoformat()
                }
                data["expenses"].insert(0, new_expense)
                save_data(data)
                analytics = calculate_analytics(data)
                self._send_json(201, {
                    "success": True,
                    "expense": new_expense,
                    "expenses": data["expenses"],
                    "analytics": analytics
                })
            return

        if path == "/api/trip-title":
            title = body.get("tripName", "").strip()
            if not title:
                self._send_json(400, {"error": "Title required"})
                return
            with lock:
                data = load_data()
                data["tripName"] = title
                save_data(data)
                self._send_json(200, {"success": True, "tripName": title})
            return

        if path == "/api/reset":
            with lock:
                save_data(DEFAULT_DATA)
                data = load_data()
                analytics = calculate_analytics(data)
                self._send_json(200, {"success": True, "data": data, "analytics": analytics})
            return

        self._send_json(404, {"error": "Endpoint not found"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/expenses/"):
            exp_id = path.replace("/api/expenses/", "").strip()
            with lock:
                data = load_data()
                data["expenses"] = [e for e in data["expenses"] if e["id"] != exp_id]
                save_data(data)
                analytics = calculate_analytics(data)
                self._send_json(200, {
                    "success": True,
                    "expenses": data["expenses"],
                    "analytics": analytics
                })
            return

        if path.startswith("/api/members/"):
            mem_id = path.replace("/api/members/", "").strip()
            with lock:
                data = load_data()
                # Check if member has expenses
                has_expenses = any(e["paidBy"] == mem_id or mem_id in e.get("splitBetween", []) for e in data["expenses"])
                if has_expenses:
                    self._send_json(400, {"error": "Cannot delete member with active expenses. Delete or reassign their expenses first."})
                    return
                data["members"] = [m for m in data["members"] if m["id"] != mem_id]
                save_data(data)
                analytics = calculate_analytics(data)
                self._send_json(200, {
                    "success": True,
                    "members": data["members"],
                    "analytics": analytics
                })
            return

        self._send_json(404, {"error": "Endpoint not found"})

def run():
    server_address = ("0.0.0.0", PORT)
    httpd = ThreadingHTTPServer(server_address, TripSplitterHandler)
    print(f"✨ Kolkata Night Riders Trip Splitter running on http://0.0.0.0:{PORT}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()

if __name__ == "__main__":
    run()
