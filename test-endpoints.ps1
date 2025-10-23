# Script para testar endpoints da API
$token = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMjEzMGZlZjAyNTg3ZmQ4ODYxODg2OTgyMjczNGVmNzZhMTExNjUiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQXJpZWxhIFN0ZWZhbmluaSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NMTF9GNjIwTWw3ZENzNUVwdVFDLWhUUkZQVzh6VGVoVXdRNDlWQWgzc3p0bHRyZ2lnVD1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9mZWRlcmEtYXBpIiwiYXVkIjoiZmVkZXJhLWFwaSIsImF1dGhfdGltZSI6MTc2MTIzODEyOCwidXNlcl9pZCI6IkxtSFU0amlCRU5NZHQ2UUtyR29HMW9tdVdDRDIiLCJzdWIiOiJMbUhVNGppQkVOTWR0NlFLckdvRzFvbXVXQ0QyIiwiaWF0IjoxNzYxMjM4MTI4LCJleHAiOjE3NjEyNDE3MjgsImVtYWlsIjoiYXJpZWxhYWFhYTFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMTA5MDg5Nzc5MTY0MTc2Mjc1MDgiXSwiZW1haWwiOlsiYXJpZWxhYWFhYTFAZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9fQ.psOaUBUuPXMxwdW4l8UNrGlruVmCVdKGhMH6l7f-8grPsJi_sCmmnOEiqa6QM6l93MClgWLPhHuBW2-vkxSe_unSfcuDyWLD0zgi2Cw6f-8wGqIparV8Y2Xbh56-aLxRuqHJiTqRmBhODvAOGj55LdN0oxLqHJ38oIWChkj2ATYgXTnFPax7rn0bZe0tCXGt8OXJtgMn6qlkZkl89yFLF5xbUfPxEyiADjFWnp6r3ZN9mAQqSMfddboRqfFwfz-2_bQMY923rAl-PSDYpCdWNI2u7V86s7dq4nYbv2DD0boh37q7iFZBdSvwDHzGuCaZYCdRAw75_cIJ6SqwgIdwsA"
$baseUrl = "https://us-central1-federa-api.cloudfunctions.net/api"
$eventId = "FederaLideres"
$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "`n=== 1. CHECK SPOT ===" -ForegroundColor Green
try {
    $response1 = Invoke-RestMethod -Uri "$baseUrl/events/$eventId/check-spot" -Headers $headers
    Write-Host "Response: $($response1 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 2. RESERVE SPOT ===" -ForegroundColor Green
try {
    $body = @{
        ticket_kind = "full"
        userType = "client"
    } | ConvertTo-Json
    $response2 = Invoke-RestMethod -Uri "$baseUrl/events/$eventId/reserve-spot" -Method POST -Headers $headers -Body $body
    Write-Host "Response: $($response2 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 3. GET USER RESERVATIONS ===" -ForegroundColor Green
try {
    $response3 = Invoke-RestMethod -Uri "$baseUrl/users/reservations" -Headers $headers
    Write-Host "Response: $($response3 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 4. GET INSTALLMENTS ===" -ForegroundColor Green
try {
    $response4 = Invoke-RestMethod -Uri "$baseUrl/events/$eventId/installments" -Headers $headers
    Write-Host "Response: $($response4 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 5. GET WAITING LIST ===" -ForegroundColor Green
try {
    $response5 = Invoke-RestMethod -Uri "$baseUrl/events/$eventId/waiting-list" -Headers $headers
    Write-Host "Response: $($response5 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 6. GET EVENT RESERVATIONS ===" -ForegroundColor Green
try {
    $response6 = Invoke-RestMethod -Uri "$baseUrl/events/$eventId/reservations" -Headers $headers
    Write-Host "Response: $($response6 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 7. GET TICKET ===" -ForegroundColor Green
try {
    $response7 = Invoke-RestMethod -Uri "$baseUrl/tickets/$eventId/purchase" -Headers $headers
    Write-Host "Response: $($response7 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 8. JOB STATUS ===" -ForegroundColor Green
try {
    $response8 = Invoke-RestMethod -Uri "$baseUrl/events/jobs/status" -Headers $headers
    Write-Host "Response: $($response8 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 9. START JOBS ===" -ForegroundColor Green
try {
    $response9 = Invoke-RestMethod -Uri "$baseUrl/events/jobs/start" -Method POST -Headers $headers
    Write-Host "Response: $($response9 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 10. JOB STATUS AFTER START ===" -ForegroundColor Green
try {
    $response10 = Invoke-RestMethod -Uri "$baseUrl/events/jobs/status" -Headers $headers
    Write-Host "Response: $($response10 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 11. STOP JOBS ===" -ForegroundColor Green
try {
    $response11 = Invoke-RestMethod -Uri "$baseUrl/events/jobs/stop" -Method POST -Headers $headers
    Write-Host "Response: $($response11 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 12. JOB STATUS AFTER STOP ===" -ForegroundColor Green
try {
    $response12 = Invoke-RestMethod -Uri "$baseUrl/events/jobs/status" -Headers $headers
    Write-Host "Response: $($response12 | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== COMPLETED ===" -ForegroundColor Cyan
