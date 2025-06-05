import pandas as pd
import os
import sqlite3
from pathlib import Path

def clean_mcas(input_path="../data/raw/MCAS_Achievement_Results.csv", output_path='mcas.db'):
    # Read the CSV file
    path = os.path.expanduser(input_path)
    combined = pd.read_csv(path, dtype={'ORG_CODE': str})
    print(combined.head())
    combined = combined[combined['STU_GRP'] == 'All Students']

    # Verify unique identifiers
    unique_count = combined[['ORG_CODE', 'SUBJECT_CODE', 'TEST_GRADE', 'SY']].drop_duplicates().shape[0]
    total_count = combined.shape[0]
    assert total_count == unique_count

    # Drop specific test grades
    combined = combined[~combined['TEST_GRADE'].isin(['ALL (03-08)', 'HS SCI'])]

    # Process and transform the data
    output = combined[['SUBJECT_CODE', 'M_PLUS_E_CNT', 'E_CNT', 'STU_CNT', 
                    'DIST_NAME', 'ORG_NAME', 'TEST_GRADE', 'SY', 'ORG_CODE']].copy()

    output = output.assign(
        year=output['SY'].astype(int),
        grade=output['TEST_GRADE'].astype(int),
        n_me=output['M_PLUS_E_CNT'].astype(int),
        n_e=output['E_CNT'].astype(int),
        n=output['STU_CNT'].astype(int),
        ORG_CODE=output['ORG_CODE'].astype(str)
    )

    # Drop original columns
    output = output.drop(['M_PLUS_E_CNT', 'E_CNT', 'STU_CNT', 'TEST_GRADE', 'SY'], axis=1)

    # Write to SQLite database
    conn = sqlite3.connect(output_path)
    output.to_sql('mcas', conn, if_exists='replace', index=False)
    conn.close()