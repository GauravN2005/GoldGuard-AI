# GoldGuard AI Database Design Specification

## Database

PostgreSQL

---

# users

id

full_name

email

phone

password_hash

role

branch_id

status

created_at

updated_at

---

# branches

id

name

code

city

state

manager_id

status

created_at

updated_at

---

# customers

id

customer_code

full_name

phone

email

address

kyc_number

created_at

updated_at

---

# inspections

id

inspection_number

customer_id

branch_id

employee_id

jewelry_type

purity

weight

length

width

height

notes

status

authenticity_score

risk_score

confidence_score

recommended_ltv

recommended_loan_amount

inspection_date

created_at

updated_at

---

# inspection_images

id

inspection_id

image_type

file_url

uploaded_by

created_at

Types:

front

back

left

right

top

reflection

touchstone

---

# inspection_results

id

inspection_id

density_score

surface_score

reflection_score

touchstone_score

visual_score

overall_score

created_at

---

# evidence_vault

id

inspection_id

file_name

file_type

file_url

uploaded_by

created_at

---

# escalations

id

inspection_id

created_by

assigned_to

status

priority

reason

decision

created_at

updated_at

---

# reports

id

report_number

report_type

generated_by

branch_id

file_url

created_at

---

# notifications

id

user_id

title

message

type

is_read

created_at

---

# audit_logs

id

user_id

action

entity_type

entity_id

old_value

new_value

ip_address

created_at

---

# drafts

id

user_id

draft_type

payload_json

status

created_at

updated_at

---

# employee_performance

id

employee_id

total_inspections

approved_cases

flagged_cases

accuracy_score

updated_at

---

# branch_metrics

id

branch_id

total_inspections

fraud_cases

approval_rate

portfolio_value

updated_at

---

# customer_loan_history

id

customer_id

loan_number

loan_amount

loan_status

loan_date

created_at

---

# Indexes

inspection_number

customer_code

loan_number

branch_id

employee_id

inspection_date

status

risk_score

created_at

---

# Relationships

Branch → Employees

Branch → Inspections

Branch → Reports

Customer → Inspections

Customer → Loan History

Inspection → Images

Inspection → Results

Inspection → Evidence

Inspection → Escalations

Inspection → Audit Logs

User → Notifications

User → Drafts

Employee → Performance

---

# Future AI Tables

Keep Reserved

ai_jobs

ai_predictions

ai_models

ai_feedback

Do not implement business logic now.

Create schema only.

Database must support:

1000+ Branches

100,000+ Customers

1,000,000+ Inspections

Multi-year audit history

Horizontal scaling readiness.

Generate complete PostgreSQL schema, SQLAlchemy models, migrations, constraints, indexes, and relationship mappings.
