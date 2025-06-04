import pandas as pd
from pathlib import Path

# DOR = Department of Revenue

def clean_dor_data(paths=None):
    if paths is None:
        paths = {
            "demographics": "CommunityComparisonGeneral.xlsx",
            "spending": "GenFundExpenditures2023.xlsx",
            "revenue": "CC_Revenue_by_Source.xlsx",
            "levies": "CC_Levies_and_Tax_by_Class.xlsx",
            "municipalities": "municipalities.csv",
        }

    # Read Excel files
    demographics = pd.read_excel(paths["demographics"])
    spending = pd.read_excel(paths["spending"])
    # probably makes sense to include Enterprise and CPA Funds
    revenue = pd.read_excel(paths["revenue"], skiprows=1)
    levies = pd.read_excel(paths["levies"])

    # Print data types for debugging
    print("\nData types for 'DOR Code' column in each dataframe:")
    print(f"demographics: {demographics['DOR Code'].dtype}")
    print(f"spending: {spending['DOR Code'].dtype}")
    print(f"revenue: {revenue['DOR Code'].dtype}")
    print(f"levies: {levies['DOR Code'].dtype}\n")

    municipalities = demographics.copy()

    # Drop the Totals row and convert DOR Code to integer
    spending = spending[spending['DOR Code'] != 'Totals:']
    spending['DOR Code'] = spending['DOR Code'].astype(int)

    # Perform joins for each dataset
    datasets = [spending, revenue, levies]
    for data in datasets:
        # Find columns to drop (all columns except 'DOR Code' that exist in demographics)
        drop_cols = [col for col in data.columns 
                    if col != "DOR Code" and col in demographics.columns]
        print(f"Dropping columns: {drop_cols}")
        
        # Keep only unique columns and join with municipalities
        data_filtered = data.drop(columns=drop_cols)
        municipalities = municipalities.merge(data_filtered, 
                                        on="DOR Code", 
                                        how="left")

    # it would be nice to have number of students

    # Save the final dataset
    municipalities.to_csv(paths["municipalities"], index=False) 