#!/usr/bin/env bash
# ========================================================
# Nosh Dish Dashboard - Automated Verification Script
# Tests: 200 OK, 400 Validation, 404 Not Found, 409 Conflict,
#        and Parallel Concurrent Writes
# ========================================================

BASE_URL="http://localhost:5000/dishes"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Starting Dish Dashboard API Verification ===${NC}\n"

# 1. GET /dishes
echo -e "${BLUE}[Test 1] GET /dishes${NC}"
GET_RES=$(curl -s -w "\n%{http_code}" "$BASE_URL")
HTTP_CODE=$(echo "$GET_RES" | tail -n1)
BODY=$(echo "$GET_RES" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ Passed: Status 200 OK${NC}"
else
  echo -e "${RED}✗ Failed: Expected 200, got $HTTP_CODE${NC}"
fi

# Fetch dish 1 current version
DISH1_VER=$(echo "$BODY" | grep -o '"dishId":"1"[^}]*' | grep -o '"version":[0-9]*' | cut -d: -f2)
if [ -z "$DISH1_VER" ]; then DISH1_VER=1; fi
echo "Dish 1 current version: $DISH1_VER"
echo ""

# 2. Valid PATCH update
echo -e "${BLUE}[Test 2] Valid PATCH update on Dish 1${NC}"
PATCH_RES=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/1" \
  -H "Content-Type: application/json" \
  -d "{\"dishName\": \"Jeera Rice Verified\", \"isPublished\": true, \"expectedVersion\": $DISH1_VER}")
HTTP_CODE=$(echo "$PATCH_RES" | tail -n1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ Passed: Status 200 OK (Version incremented)$NC"
else
  echo -e "${RED}✗ Failed: Expected 200, got $HTTP_CODE${NC}"
fi

NEW_VER=$((DISH1_VER + 1))
echo ""

# 3. 409 Conflict with Stale expectedVersion
echo -e "${BLUE}[Test 3] 409 Conflict (stale expectedVersion)${NC}"
CONFLICT_RES=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/1" \
  -H "Content-Type: application/json" \
  -d "{\"dishName\": \"Stale Edit\", \"isPublished\": true, \"expectedVersion\": $DISH1_VER}")
HTTP_CODE=$(echo "$CONFLICT_RES" | tail -n1)

if [ "$HTTP_CODE" -eq 409 ]; then
  echo -e "${GREEN}✓ Passed: Status 409 Conflict returned as expected${NC}"
else
  echo -e "${RED}✗ Failed: Expected 409, got $HTTP_CODE${NC}"
fi
echo ""

# 4. 400 Bad Request on Empty Name
echo -e "${BLUE}[Test 4] 400 Bad Request on empty dishName${NC}"
EMPTY_RES=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/1" \
  -H "Content-Type: application/json" \
  -d "{\"dishName\": \"   \", \"isPublished\": false, \"expectedVersion\": $NEW_VER}")
HTTP_CODE=$(echo "$EMPTY_RES" | tail -n1)

if [ "$HTTP_CODE" -eq 400 ]; then
  echo -e "${GREEN}✓ Passed: Status 400 Bad Request for empty dishName${NC}"
else
  echo -e "${RED}✗ Failed: Expected 400, got $HTTP_CODE${NC}"
fi
echo ""

# 5. 404 Not Found for unknown dishId
echo -e "${BLUE}[Test 5] 404 Not Found for non-existent dishId${NC}"
NOTFOUND_RES=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/99999" \
  -H "Content-Type: application/json" \
  -d "{\"dishName\": \"Ghost Dish\", \"isPublished\": false, \"expectedVersion\": 1}")
HTTP_CODE=$(echo "$NOTFOUND_RES" | tail -n1)

if [ "$HTTP_CODE" -eq 404 ]; then
  echo -e "${GREEN}✓ Passed: Status 404 Not Found for unknown dishId${NC}"
else
  echo -e "${RED}✗ Failed: Expected 404, got $HTTP_CODE${NC}"
fi
echo ""

# 6. Concurrent Parallel Requests Test
echo -e "${BLUE}[Test 6] Concurrent race condition: 2 parallel PATCH requests with same version${NC}"
echo "Sending two simultaneous requests with expectedVersion: $NEW_VER..."

curl -s -w "%{http_code}\n" -X PATCH "$BASE_URL/1" \
  -H "Content-Type: application/json" \
  -d "{\"dishName\": \"Parallel A\", \"isPublished\": true, \"expectedVersion\": $NEW_VER}" > /tmp_res_a.txt &
PID_A=$!

curl -s -w "%{http_code}\n" -X PATCH "$BASE_URL/1" \
  -H "Content-Type: application/json" \
  -d "{\"dishName\": \"Parallel B\", \"isPublished\": true, \"expectedVersion\": $NEW_VER}" > /tmp_res_b.txt &
PID_B=$!

wait $PID_A
wait $PID_B

CODE_A=$(cat /tmp_res_a.txt 2>/dev/null || echo "")
CODE_B=$(cat /tmp_res_b.txt 2>/dev/null || echo "")
rm -f /tmp_res_a.txt /tmp_res_b.txt

echo "Request A code: $CODE_A, Request B code: $CODE_B"
if { [ "$CODE_A" = "200" ] && [ "$CODE_B" = "409" ]; } || { [ "$CODE_A" = "409" ] && [ "$CODE_B" = "200" ]; }; then
  echo -e "${GREEN}✓ Passed: Exactly one request succeeded (200) and the other was safely rejected (409 Conflict)${NC}"
else
  echo -e "${RED}✗ Review race codes: Code A: $CODE_A, Code B: $CODE_B${NC}"
fi

echo -e "\n${BLUE}=== Verification Complete ===${NC}"
