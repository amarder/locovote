import pandas as pd
import os
import sqlite3
import pdb
from pathlib import Path

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

if __name__ == "__main__":
    clean_mcas()