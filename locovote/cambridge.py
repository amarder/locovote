import pandas as pd
import os
import sqlite3
import pdb
from pathlib import Path
import json

def clean_mcas(input_path="../data/raw/MCAS_Achievement_Results.csv", output_path='../data/processed/cambridge.db'):
    # Read the CSV file
    path = os.path.expanduser(input_path)
    combined = pd.read_csv(path, dtype={'ORG_CODE': str})
    
    # Filter to Cambridge district, ELA/MATH subjects, and specific test grades
    combined = combined[
        (combined['DIST_NAME'] == 'Cambridge') & 
        (combined['SUBJECT_CODE'].isin(['ELA', 'MATH'])) &
        (combined['TEST_GRADE'].isin(['ALL (03-08)', '10']))
    ]
    
    # Extract white student count data before filtering
    white_students = combined[combined['STU_GRP'] == 'White'][['ORG_CODE', 'SUBJECT_CODE', 'TEST_GRADE', 'SY', 'STU_CNT']].copy()
    white_students = white_students.rename(columns={'STU_CNT': 'STU_CNT_WHITE'})
    
    # Filter to "All Students" data
    combined = combined[combined['STU_GRP'] == 'All Students']
    
    # Merge white student count data back
    combined = combined.merge(white_students, on=['ORG_CODE', 'SUBJECT_CODE', 'TEST_GRADE', 'SY'], how='left')

    # Verify unique identifiers
    unique_count = combined[['ORG_CODE', 'SUBJECT_CODE', 'TEST_GRADE', 'SY']].drop_duplicates().shape[0]
    total_count = combined.shape[0]
    assert total_count == unique_count

    # Note: We now keep 'ALL (03-08)' and '10' test grades as filtered above
    # Drop only 'HS SCI' if present (though it should already be filtered out)
    combined = combined[~combined['TEST_GRADE'].isin(['HS SCI'])]

    # Process and transform the data
    output = combined[['SUBJECT_CODE', 'M_PLUS_E_CNT', 'E_CNT', 'STU_CNT', 
                    'DIST_NAME', 'ORG_NAME', 'TEST_GRADE', 'SY', 'ORG_CODE',
                    'AVG_SGP', 'AVG_SGP_INCL', 'STU_CNT_WHITE']].copy()

    output = output.assign(
        year=output['SY'].astype(int),
        grade=output['TEST_GRADE'],
        n_me=output['M_PLUS_E_CNT'].astype(int),
        n_e=output['E_CNT'].astype(int),
        n=output['STU_CNT'].astype(int),
        n_white=pd.to_numeric(output['STU_CNT_WHITE'], errors='coerce').astype('Int64'),
        ORG_CODE=output['ORG_CODE'].astype(str),
        avg_sgp=pd.to_numeric(output['AVG_SGP'], errors='coerce'),
        avg_sgp_incl=pd.to_numeric(output['AVG_SGP_INCL'], errors='coerce')
    )

    # Drop original columns
    output = output.drop(['M_PLUS_E_CNT', 'E_CNT', 'STU_CNT', 'TEST_GRADE', 'SY', 
                         'AVG_SGP', 'AVG_SGP_INCL', 'STU_CNT_WHITE'], axis=1)

    # Write to SQLite database
    conn = sqlite3.connect(output_path)
    output.to_sql('mcas', conn, if_exists='replace', index=False)
    conn.close()

def get_school_types_from_data(input_path="../data/raw/MCAS_Achievement_Results.csv"):
    """
    Extract school names and their types based on grade ranges from MCAS data.
    Logs a dictionary mapping school names to school types.
    """
    # Read the CSV file
    path = os.path.expanduser(input_path)
    combined = pd.read_csv(path, dtype={'ORG_CODE': str})
    
    # Filter to Cambridge district and exclude district-level records
    cambridge_schools = combined[
        (combined['DIST_NAME'] == 'Cambridge') & 
        (~combined['ORG_CODE'].str.endswith('0000'))  # Exclude district-level records
    ]
    
    # Drop rows with TEST_GRADE = 'ALL (03-08)' to get more accurate school categorization
    cambridge_schools = cambridge_schools[cambridge_schools['TEST_GRADE'] != 'ALL (03-08)']
    
    # Get unique schools with their grade ranges
    school_grades = cambridge_schools.groupby(['ORG_NAME', 'ORG_CODE'])['TEST_GRADE'].apply(list).reset_index()
    
    school_types = {}
    
    for _, row in school_grades.iterrows():
        school_name = row['ORG_NAME']
        grades = row['TEST_GRADE']
        
        # Convert grades to integers, handling special cases
        numeric_grades = []
        for grade in grades:
            if isinstance(grade, str):
                if grade == 'ALL (03-08)':
                    numeric_grades.extend([3, 4, 5, 6, 7, 8])
                elif grade == 'HS SCI':
                    numeric_grades.append(10)  # High school science
                else:
                    try:
                        numeric_grades.append(int(grade))
                    except ValueError:
                        continue
            else:
                numeric_grades.append(int(grade))
        
        if not numeric_grades:
            continue
            
        min_grade = min(numeric_grades)
        max_grade = max(numeric_grades)
        
        # Categorize by grade level using the same logic as the frontend
        if max_grade <= 5:
            school_type = "Elementary"
        elif min_grade >= 6 and max_grade <= 8:
            school_type = "Middle"
        elif min_grade >= 9:
            school_type = "High"
        elif min_grade <= 5 and max_grade >= 9:
            school_type = "K-12"
        else:
            school_type = "Elementary and Middle"
        
        school_types[school_name] = school_type
    
    # Print the school types dictionary with nice formatting
    print("Cambridge Public Schools by Type:")
    print("School Types Dictionary:")
    print(json.dumps(school_types, indent=2, sort_keys=True))
    
    # Also print in a more readable format organized by type
    print("\nCambridge Schools by Type:")
    schools_by_type = {}
    for school_type in ["Elementary", "Middle", "High", "K-12", "Elementary and Middle"]:
        schools_of_type = [name for name, type_ in school_types.items() if type_ == school_type]
        if schools_of_type:
            schools_by_type[school_type] = sorted(schools_of_type)
    
    print(json.dumps(schools_by_type, indent=2))
    
    return school_types

if __name__ == "__main__":
    clean_mcas()
    get_school_types_from_data()