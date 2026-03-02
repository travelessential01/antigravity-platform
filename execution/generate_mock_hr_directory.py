"""
Mock HR Staff Directory Generator for Antigravity Pre-Task 2.2
Generates a realistic hospital staff directory CSV with UPNs, Object IDs,
departments, and mapped Antigravity roles for IdP group configuration.
"""

import csv
import uuid
import os
import random
from typing import TypedDict, List, Tuple

# Antigravity Role Mapping
# ANTIGRAVITY_QUALITY -> quality_coordinator
# ANTIGRAVITY_DEPT_MANAGER -> department_manager
# ANTIGRAVITY_ADMIN -> admin
# ANTIGRAVITY_MED_SUPT -> medical_superintendent
# ANTIGRAVITY_DPO -> dpo

HOSPITAL_DOMAIN = "apollohospital.local"
HOSPITAL_NAME = "Apollo Multispeciality Hospital"
HOSPITAL_ID = str(uuid.uuid4())

FIRST_NAMES = ["Amit", "Neha", "Priya", "Rajesh", "Sneha", "Vikram", "Ananya", "Rahul", "Pooja", "Suresh", "Lakshmi", "Ramesh", "Deepa", "Anil", "Meera", "Sanjay", "Kavitha", "Arjun", "Aditi", "Karan", "Nisha", "Ravi", "Vivek", "Pallavi", "Sunil", "Deepak", "Aisha", "Kiran", "Vijay", "Anita", "Rohit", "Swati", "Mahesh", "Kriti", "Ajay", "Divya", "Vinay", "Preeti", "Alok", "Priyanka", "Nitin", "Shweta", "Tarun", "Ritu", "Gaurav", "Simran", "Varun", "Riya", "Mohit", "Meghna"]
LAST_NAMES = ["Sharma", "Reddy", "Nair", "Kumar", "Patel", "Mehta", "Iyer", "Gupta", "Krishnan", "Deshmukh", "Khan", "Kapoor", "Menon", "Chatterjee", "Thomas", "Devi", "Singh", "Rao", "Verma", "Das", "Yadav", "Pandey", "Tiwari", "Saxena", "Joshi", "Bhatia", "Banerjee", "Malhotra", "Agarwal", "Sinha", "Jain", "Chandra", "Rawat", "Bose", "Dasgupta", "Sen", "Nath", "Chopra", "Kaur", "Garg", "Dubey", "Mishra", "Shukla", "Agnihotri", "Chauhan", "Rajput", "Kulkarni", "Jadhav", "Bhatt", "Dave"]

def get_random_name():
    return random.choice(FIRST_NAMES), random.choice(LAST_NAMES)

def generate_staff(count: int, title_prefix: str, title: str, role: str, group: str) -> List[Tuple[str, str, str, str, str]]:
    staff: List[Tuple[str, str, str, str, str]] = []
    for _ in range(count):
        f, l = get_random_name()
        if title_prefix:
            f = f"{title_prefix} {f}"
        staff.append((f, l, title, role, group))
    return staff

class DepartmentData(TypedDict):
    id: str
    escalation_level: int
    staff: List[Tuple[str, str, str, str, str]]

# Department structure: (department_name, department_id, staff_list)
DEPARTMENTS: dict[str, DepartmentData] = {
    "Quality": {
        "id": str(uuid.uuid4()),
        "escalation_level": 3,
        "staff": [
            ("Priya", "Sharma", "Chief Quality Officer", "quality_coordinator", "ANTIGRAVITY_QUALITY"),
        ] + generate_staff(9, "", "Quality Auditor", "quality_coordinator", "ANTIGRAVITY_QUALITY")
    },
    "Operations": {
        "id": str(uuid.uuid4()),
        "escalation_level": 2,
        "staff": [
            ("Rajesh", "Kumar", "Operations Director", "department_manager", "ANTIGRAVITY_DEPT_MANAGER"),
        ] + generate_staff(10, "", "Operations Executive", "department_manager", "ANTIGRAVITY_DEPT_MANAGER")
    },
    "Procurement": {
        "id": str(uuid.uuid4()),
        "escalation_level": 2,
        "staff": [
            ("Arjun", "Mehta", "Procurement Head", "department_manager", "ANTIGRAVITY_DEPT_MANAGER"),
        ] + generate_staff(5, "", "Purchase Officer", "department_manager", "ANTIGRAVITY_DEPT_MANAGER")
    },
    "Medicine": {
        "id": str(uuid.uuid4()),
        "escalation_level": 1,
        "staff": [
            ("Dr. Sanjay", "Gupta", "HOD - Internal Medicine", "department_manager", "ANTIGRAVITY_DEPT_MANAGER"),
        ] + generate_staff(15, "Dr.", "Medical Consultant", "department_manager", "ANTIGRAVITY_DEPT_MANAGER")
    },
    "Surgery": {
        "id": str(uuid.uuid4()),
        "escalation_level": 1,
        "staff": [
            ("Dr. Anil", "Kapoor", "HOD - General Surgery", "department_manager", "ANTIGRAVITY_DEPT_MANAGER"),
        ] + generate_staff(10, "Dr.", "Surgeon", "department_manager", "ANTIGRAVITY_DEPT_MANAGER")
    },
    "Nursing": {
        "id": str(uuid.uuid4()),
        "escalation_level": 1,
        "staff": [
            ("Sister", "Mary Thomas", "Chief Nursing Officer", "department_manager", "ANTIGRAVITY_DEPT_MANAGER"),
        ] + generate_staff(30, "", "Staff Nurse", "department_manager", "ANTIGRAVITY_DEPT_MANAGER")
    },
    "Housekeeping": {
        "id": str(uuid.uuid4()),
        "escalation_level": 1,
        "staff": [
            ("Ramesh", "Yadav", "Housekeeping Supervisor", "department_manager", "ANTIGRAVITY_DEPT_MANAGER"),
        ] + generate_staff(25, "", "Housekeeping Staff", "department_manager", "ANTIGRAVITY_DEPT_MANAGER")
    },
    "Administration": {
        "id": str(uuid.uuid4()),
        "escalation_level": 4,
        "staff": [
            ("Amit", "Saxena", "Hospital Administrator", "admin", "ANTIGRAVITY_ADMIN"),
            ("Neha", "Joshi", "System Administrator", "admin", "ANTIGRAVITY_ADMIN"),
        ] + generate_staff(3, "", "Admin Executive", "admin", "ANTIGRAVITY_ADMIN")
    },
    "Medical Superintendent Office": {
        "id": str(uuid.uuid4()),
        "escalation_level": 5,
        "staff": [
            ("Dr. Suresh", "Bhatia", "Medical Superintendent", "medical_superintendent", "ANTIGRAVITY_MED_SUPT"),
        ]
    },
    "Data Protection Office": {
        "id": str(uuid.uuid4()),
        "escalation_level": 5,
        "staff": [
            ("Aditi", "Banerjee", "Data Protection Officer", "dpo", "ANTIGRAVITY_DPO"),
        ]
    },
    "Emergency": {
        "id": str(uuid.uuid4()),
        "escalation_level": 1,
        "staff": [
            ("Dr. Karan", "Malhotra", "HOD - Emergency Medicine", "department_manager", "ANTIGRAVITY_DEPT_MANAGER"),
        ] + generate_staff(12, "Dr.", "Emergency Physician", "department_manager", "ANTIGRAVITY_DEPT_MANAGER")
    },
    "Radiology": {
        "id": str(uuid.uuid4()),
        "escalation_level": 1,
        "staff": [
            ("Dr. Vivek", "Sinha", "HOD - Radiology", "department_manager", "ANTIGRAVITY_DEPT_MANAGER"),
        ] + generate_staff(5, "Dr.", "Radiologist", "department_manager", "ANTIGRAVITY_DEPT_MANAGER")
    },
    "Pharmacy": {
        "id": str(uuid.uuid4()),
        "escalation_level": 1,
        "staff": [
            ("Sunil", "Chandra", "Chief Pharmacist", "department_manager", "ANTIGRAVITY_DEPT_MANAGER"),
        ] + generate_staff(6, "", "Staff Pharmacist", "department_manager", "ANTIGRAVITY_DEPT_MANAGER")
    },
}

def generate_upn(first_name: str, last_name: str, domain: str) -> str:
    """Generate a User Principal Name (email-style) for the staff member."""
    clean_first = first_name.lower().replace("dr. ", "").replace("sister ", "").replace(" ", ".")
    clean_last = last_name.lower().replace(" ", ".")
    salt = str(random.randint(100, 999))
    return f"{clean_first}.{clean_last}{salt}@{domain}"

def generate_directory():
    """Generate the mock staff directory CSV and summary."""
    output_dir = os.path.join(os.path.dirname(__file__), '..', '.tmp')
    os.makedirs(output_dir, exist_ok=True)
    csv_path = os.path.join(output_dir, 'mock_staff_directory.csv')
    summary_path = os.path.join(output_dir, 'staff_directory_summary.txt')

    total_staff: int = 0
    role_counts: dict[str, int] = {}

    with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow([
            'object_id',
            'user_principal_name',
            'first_name',
            'last_name',
            'job_title',
            'department',
            'department_id',
            'escalation_level',
            'hospital_name',
            'hospital_id',
            'antigravity_role',
            'antigravity_group',
            'mfa_required',
        ])

        for dept_name, dept_data in DEPARTMENTS.items():
            staff_list: List[Tuple[str, str, str, str, str]] = list(dept_data["staff"])
            for first, last, title, role, group in staff_list:
                object_id = str(uuid.uuid4())
                upn = generate_upn(first, last, HOSPITAL_DOMAIN)
                # MFA is mandatory for admin, quality_coordinator, medical_superintendent, department_manager
                role_str = str(role)
                mfa_required = role_str in ("admin", "quality_coordinator", "medical_superintendent", "department_manager", "dpo")

                writer.writerow([
                    object_id,
                    upn,
                    first,
                    last,
                    title,
                    dept_name,
                    str(dept_data["id"]),
                    int(dept_data["escalation_level"]),
                    HOSPITAL_NAME,
                    HOSPITAL_ID,
                    role_str,
                    str(group),
                    mfa_required,
                ])
                total_staff += 1
                role_counts[role_str] = role_counts.get(role_str, 0) + 1

    # Write summary
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write(f"Mock Staff Directory Summary\n")
        f.write(f"{'='*40}\n")
        f.write(f"Hospital: {HOSPITAL_NAME}\n")
        f.write(f"Hospital ID: {HOSPITAL_ID}\n")
        f.write(f"Domain: {HOSPITAL_DOMAIN}\n")
        f.write(f"Total Staff: {total_staff}\n")
        f.write(f"Total Departments: {len(list(DEPARTMENTS.keys()))}\n\n")
        f.write(f"Role Distribution:\n")
        for role, count in sorted(role_counts.items()):
            f.write(f"  {role}: {count}\n")
        f.write(f"\nDepartment Breakdown:\n")
        for dept_name, dept_data in DEPARTMENTS.items():
            f.write(f"  {dept_name} (Level {dept_data['escalation_level']}): {len(dept_data['staff'])} staff\n")

    print(f"✅ Generated mock staff directory: {os.path.abspath(csv_path)}")
    print(f"✅ Generated summary: {os.path.abspath(summary_path)}")
    print(f"📊 Total staff: {total_staff} across {len(DEPARTMENTS)} departments")
    for role, count in sorted(role_counts.items()):
        print(f"   • {role}: {count}")

if __name__ == "__main__":
    generate_directory()
