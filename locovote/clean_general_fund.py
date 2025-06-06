#!/usr/bin/env python3
"""
Script to combine general fund expenditure and revenue data from multiple Excel files
into a single dataframe with municipality and year as unique identifiers.
"""

import pandas as pd
import numpy as np
import os
import glob
import re
from pathlib import Path
import warnings
import pyarrow as pa

# Suppress openpyxl warnings
warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')

def extract_year_from_filename(filename):
    """Extract year from filename like 'GenFundExpenditures2024.xlsx'"""
    match = re.search(r'(\d{4})', filename)
    return int(match.group(1)) if match else None

def load_and_validate_expenditures(file_path, expected_year):
    """Load expenditures file and validate its structure"""
    try:
        df = pd.read_excel(file_path)
        
        # Expected columns for expenditures
        expected_columns = [
            'DOR Code', 'Municipality', 'Fiscal Year', 'General Government',
            'Public Safety', 'Education', 'Public Works', 'Human Services',
            'Culture and Recreation', 'Fixed Costs', 'Intergov Assessments',
            'Other Expenditures', 'Debt Service', 'Total Expenditures'
        ]
        
        # Check if all expected columns are present
        missing_cols = set(expected_columns) - set(df.columns)
        if missing_cols:
            print(f"WARNING: {file_path} missing columns: {missing_cols}")
            return None
        
        # Remove rows where Municipality is NaN or empty
        df = df.dropna(subset=['Municipality'])
        df = df[df['Municipality'].str.strip() != '']
        
        # Convert Fiscal Year to integer
        if 'Fiscal Year' in df.columns:
            df['Fiscal Year'] = df['Fiscal Year'].astype('Int64')  # Use nullable integer type
        
        # Validate year consistency
        if 'Fiscal Year' in df.columns:
            file_years = df['Fiscal Year'].dropna().unique()
            if len(file_years) == 1 and file_years[0] != expected_year:
                print(f"WARNING: {file_path} year mismatch. Expected {expected_year}, found {file_years[0]}")
        
        # Add data type indicator
        df['data_type'] = 'expenditures'
        df['source_file'] = os.path.basename(file_path)
        
        return df
        
    except Exception as e:
        print(f"ERROR loading {file_path}: {e}")
        return None

def load_and_validate_revenues(file_path, expected_year):
    """Load revenues file and validate its structure"""
    try:
        df = pd.read_excel(file_path)
        
        # Expected columns for revenues
        expected_columns = [
            'DOR Code', 'Municipality', 'Fiscal Year', 'Taxes', 'Service Charges',
            'Licenses and Permits', 'Federal Revenue', 'State Revenue',
            'Revenue from Other Governments', 'Special Assessments',
            'Fines and Forfeitures', 'Miscellaneous', 'Other Financing Sources',
            'Transfers', 'Total Revenues'
        ]
        
        # Check if all expected columns are present
        missing_cols = set(expected_columns) - set(df.columns)
        if missing_cols:
            print(f"WARNING: {file_path} missing columns: {missing_cols}")
            return None
        
        # Remove rows where Municipality is NaN or empty
        df = df.dropna(subset=['Municipality'])
        df = df[df['Municipality'].str.strip() != '']
        
        # Convert Fiscal Year to integer
        if 'Fiscal Year' in df.columns:
            df['Fiscal Year'] = df['Fiscal Year'].astype('Int64')  # Use nullable integer type
        
        # Validate year consistency
        if 'Fiscal Year' in df.columns:
            file_years = df['Fiscal Year'].dropna().unique()
            if len(file_years) == 1 and file_years[0] != expected_year:
                print(f"WARNING: {file_path} year mismatch. Expected {expected_year}, found {file_years[0]}")
        
        # Add data type indicator
        df['data_type'] = 'revenues'
        df['source_file'] = os.path.basename(file_path)
        
        return df
        
    except Exception as e:
        print(f"ERROR loading {file_path}: {e}")
        return None

def combine_expenditures_and_revenues(exp_df, rev_df):
    """Combine expenditures and revenues data for the same municipality and year"""
    if exp_df is None or rev_df is None:
        return None
    
    # Define columns to add prefixes to
    expenditure_columns = [
        'General Government', 'Public Safety', 'Education', 'Public Works', 
        'Human Services', 'Culture and Recreation', 'Fixed Costs', 
        'Intergov Assessments', 'Other Expenditures', 'Debt Service', 'Total Expenditures'
    ]
    
    revenue_columns = [
        'Taxes', 'Service Charges', 'Licenses and Permits', 'Federal Revenue', 
        'State Revenue', 'Revenue from Other Governments', 'Special Assessments', 
        'Fines and Forfeitures', 'Miscellaneous', 'Other Financing Sources', 
        'Transfers', 'Total Revenues'
    ]
    
    # Create copies to avoid modifying original dataframes
    exp_df_copy = exp_df.copy()
    rev_df_copy = rev_df.copy()
    
    # Add prefixes to expenditure columns
    exp_rename_dict = {col: f'exp_{col}' for col in expenditure_columns if col in exp_df_copy.columns}
    exp_df_copy = exp_df_copy.rename(columns=exp_rename_dict)
    
    # Add prefixes to revenue columns  
    rev_rename_dict = {col: f'rev_{col}' for col in revenue_columns if col in rev_df_copy.columns}
    rev_df_copy = rev_df_copy.rename(columns=rev_rename_dict)
    
    # Merge on DOR Code, Municipality, and Fiscal Year
    combined = pd.merge(
        exp_df_copy, rev_df_copy,
        on=['DOR Code', 'Municipality', 'Fiscal Year'],
        how='outer',
        suffixes=('_exp', '_rev')
    )
    
    # Clean up duplicate columns
    combined['data_type'] = 'combined'
    combined['source_file_exp'] = combined.get('source_file_exp', combined.get('source_file', ''))
    combined['source_file_rev'] = combined.get('source_file_rev', combined.get('source_file', ''))
    
    # Drop the individual data_type and source_file columns if they exist
    columns_to_drop = ['data_type_exp', 'data_type_rev', 'source_file']
    columns_to_drop = [col for col in columns_to_drop if col in combined.columns]
    if columns_to_drop:
        combined = combined.drop(columns=columns_to_drop)
    
    # Remove any remaining rows with NaN municipality
    combined = combined.dropna(subset=['Municipality'])
    
    return combined

def validate_expenditure_totals(df):
    """Validate that exp_Total Expenditures equals the sum of component expenditure columns"""
    print("Validating expenditure totals...")
    
    # Component expenditure columns (excluding the total)
    exp_component_columns = [
        'exp_General Government', 'exp_Public Safety', 'exp_Education', 'exp_Public Works',
        'exp_Human Services', 'exp_Culture and Recreation', 'exp_Fixed Costs',
        'exp_Intergov Assessments', 'exp_Other Expenditures', 'exp_Debt Service'
    ]
    
    # Check which columns actually exist in the dataframe
    existing_exp_columns = [col for col in exp_component_columns if col in df.columns]
    
    if 'exp_Total Expenditures' not in df.columns:
        print("WARNING: exp_Total Expenditures column not found")
        return
    
    if not existing_exp_columns:
        print("WARNING: No component expenditure columns found")
        return
    
    print(f"Found {len(existing_exp_columns)} component expenditure columns:")
    for col in existing_exp_columns:
        print(f"  - {col}")
    
    # Calculate sum of components for each row
    df['calculated_exp_total'] = df[existing_exp_columns].sum(axis=1, skipna=True)
    
    # Compare with reported total (allowing for small rounding differences)
    tolerance = 0.01  # Allow for penny rounding differences
    differences = abs(df['exp_Total Expenditures'] - df['calculated_exp_total'])
    significant_differences = differences > tolerance
    
    if significant_differences.any():
        print(f"VALIDATION ERROR: Found {significant_differences.sum()} rows where exp_Total Expenditures doesn't match sum of components")
        print("\nSample discrepancies:")
        problem_rows = df[significant_differences][['Municipality', 'Fiscal Year', 'exp_Total Expenditures', 'calculated_exp_total']].copy()
        problem_rows['difference'] = problem_rows['exp_Total Expenditures'] - problem_rows['calculated_exp_total']
        print(problem_rows.head(10))
        
        print(f"\nLargest discrepancy: ${differences.max():,.2f}")
        print(f"Average discrepancy: ${differences[significant_differences].mean():,.2f}")
    else:
        print("✓ All expenditure totals match the sum of their components")
        max_diff = differences.max()
        print(f"  Maximum difference: ${max_diff:.2f}")
    
    # Clean up temporary column
    df.drop('calculated_exp_total', axis=1, inplace=True)

def validate_revenue_totals(df):
    """Validate that rev_Total Revenues equals the sum of component revenue columns"""
    print("\nValidating revenue totals...")
    
    # Component revenue columns (excluding the total)
    rev_component_columns = [
        'rev_Taxes', 'rev_Service Charges', 'rev_Licenses and Permits', 'rev_Federal Revenue',
        'rev_State Revenue', 'rev_Revenue from Other Governments', 'rev_Special Assessments',
        'rev_Fines and Forfeitures', 'rev_Miscellaneous', 'rev_Other Financing Sources',
        'rev_Transfers'
    ]
    
    # Check which columns actually exist in the dataframe
    existing_rev_columns = [col for col in rev_component_columns if col in df.columns]
    
    if 'rev_Total Revenues' not in df.columns:
        print("WARNING: rev_Total Revenues column not found")
        return
    
    if not existing_rev_columns:
        print("WARNING: No component revenue columns found")
        return
    
    print(f"Found {len(existing_rev_columns)} component revenue columns:")
    for col in existing_rev_columns:
        print(f"  - {col}")
    
    # Calculate sum of components for each row
    df['calculated_rev_total'] = df[existing_rev_columns].sum(axis=1, skipna=True)
    
    # Compare with reported total (allowing for small rounding differences)
    tolerance = 0.01  # Allow for penny rounding differences
    differences = abs(df['rev_Total Revenues'] - df['calculated_rev_total'])
    significant_differences = differences > tolerance
    
    if significant_differences.any():
        print(f"VALIDATION ERROR: Found {significant_differences.sum()} rows where rev_Total Revenues doesn't match sum of components")
        print("\nSample discrepancies:")
        problem_rows = df[significant_differences][['Municipality', 'Fiscal Year', 'rev_Total Revenues', 'calculated_rev_total']].copy()
        problem_rows['difference'] = problem_rows['rev_Total Revenues'] - problem_rows['calculated_rev_total']
        print(problem_rows.head(10))
        
        print(f"\nLargest discrepancy: ${differences.max():,.2f}")
        print(f"Average discrepancy: ${differences[significant_differences].mean():,.2f}")
    else:
        print("✓ All revenue totals match the sum of their components")
        max_diff = differences.max()
        print(f"  Maximum difference: ${max_diff:.2f}")
    
    # Clean up temporary column
    df.drop('calculated_rev_total', axis=1, inplace=True)

def main():
    """Main function to process all files and create combined dataset"""
    
    # Define paths
    data_dir = Path('data/raw/dor-general-fund')
    output_file = 'data/processed/combined_general_fund.arrow'
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    if not data_dir.exists():
        print(f"ERROR: Data directory {data_dir} does not exist")
        return
    
    # Get all expenditure and revenue files
    exp_files = sorted(glob.glob(str(data_dir / 'GenFundExpenditures*.xlsx')))
    rev_files = sorted(glob.glob(str(data_dir / 'GenFundRevenues*.xlsx')))
    
    print(f"Found {len(exp_files)} expenditure files and {len(rev_files)} revenue files")
    
    # Group files by year
    years_data = {}
    
    # Process expenditure files
    for file_path in exp_files:
        year = extract_year_from_filename(file_path)
        if year:
            if year not in years_data:
                years_data[year] = {}
            print(f"Loading expenditures for {year}...")
            years_data[year]['expenditures'] = load_and_validate_expenditures(file_path, year)
    
    # Process revenue files
    for file_path in rev_files:
        year = extract_year_from_filename(file_path)
        if year:
            if year not in years_data:
                years_data[year] = {}
            print(f"Loading revenues for {year}...")
            years_data[year]['revenues'] = load_and_validate_revenues(file_path, year)
    
    # Combine data for each year
    combined_yearly_data = []
    
    for year in sorted(years_data.keys()):
        print(f"Combining data for {year}...")
        exp_data = years_data[year].get('expenditures')
        rev_data = years_data[year].get('revenues')
        
        if exp_data is not None and rev_data is not None:
            combined_year = combine_expenditures_and_revenues(exp_data, rev_data)
            if combined_year is not None:
                combined_yearly_data.append(combined_year)
        else:
            if exp_data is None:
                print(f"WARNING: No expenditure data for {year}")
            if rev_data is None:
                print(f"WARNING: No revenue data for {year}")
    
    if not combined_yearly_data:
        print("ERROR: No data could be combined")
        return
    
    # Combine all years into a single dataframe
    print("Combining all years...")
    final_df = pd.concat(combined_yearly_data, ignore_index=True)
    
    # Final cleanup - remove any rows with missing municipality or year
    final_df = final_df.dropna(subset=['Municipality', 'Fiscal Year'])
    
    # Ensure municipality and year uniqueness
    print("Checking for duplicates...")
    duplicates = final_df.duplicated(subset=['Municipality', 'Fiscal Year'], keep=False)
    if duplicates.any():
        print(f"WARNING: Found {duplicates.sum()} duplicate municipality-year combinations")
        print("Sample duplicate entries:")
        print(final_df[duplicates][['Municipality', 'Fiscal Year', 'source_file_exp', 'source_file_rev']].head(10))
        
        # Remove duplicates, keeping the first occurrence
        print("Removing duplicates, keeping first occurrence...")
        final_df = final_df.drop_duplicates(subset=['Municipality', 'Fiscal Year'], keep='first')
        print(f"After removing duplicates: {len(final_df)} rows")
    
    # Sort by municipality and year
    final_df = final_df.sort_values(['Municipality', 'Fiscal Year'])
    
    # Remove unnecessary columns before saving
    columns_to_drop = ['data_type', 'exp_Total Expenditures', 'rev_Total Revenues']
    columns_to_drop = [col for col in columns_to_drop if col in final_df.columns]
    if columns_to_drop:
        final_df = final_df.drop(columns=columns_to_drop)
    
    # Validate totals before saving
    print(f"\n=== VALIDATION ===")
    # Create temporary columns for validation (since we're dropping the totals)
    temp_df = final_df.copy()
    
    # Add back the total columns temporarily for validation
    exp_component_columns = [
        'exp_General Government', 'exp_Public Safety', 'exp_Education', 'exp_Public Works',
        'exp_Human Services', 'exp_Culture and Recreation', 'exp_Fixed Costs',
        'exp_Intergov Assessments', 'exp_Other Expenditures', 'exp_Debt Service'
    ]
    existing_exp_columns = [col for col in exp_component_columns if col in temp_df.columns]
    if existing_exp_columns:
        temp_df['exp_Total Expenditures'] = temp_df[existing_exp_columns].sum(axis=1, skipna=True)
    
    rev_component_columns = [
        'rev_Taxes', 'rev_Service Charges', 'rev_Licenses and Permits', 'rev_Federal Revenue',
        'rev_State Revenue', 'rev_Revenue from Other Governments', 'rev_Special Assessments',
        'rev_Fines and Forfeitures', 'rev_Miscellaneous', 'rev_Other Financing Sources',
        'rev_Transfers'
    ]
    existing_rev_columns = [col for col in rev_component_columns if col in temp_df.columns]
    if existing_rev_columns:
        temp_df['rev_Total Revenues'] = temp_df[existing_rev_columns].sum(axis=1, skipna=True)
    
    # Run validation on the temporary dataframe
    validate_expenditure_totals(temp_df)
    validate_revenue_totals(temp_df)
    
    # Save to Arrow format
    print(f"\nSaving combined data to {output_file}...")
    final_df.to_feather(output_file, compression="uncompressed")
    
    # Print summary statistics
    print(f"\n=== SUMMARY ===")
    print(f"Total rows: {len(final_df)}")
    print(f"Total municipalities: {final_df['Municipality'].nunique()}")
    print(f"Year range: {final_df['Fiscal Year'].min():.0f} - {final_df['Fiscal Year'].max():.0f}")
    print(f"Total columns: {len(final_df.columns)}")
    
    # Check for any missing municipality-year combinations
    expected_combinations = len(final_df['Municipality'].unique()) * len(final_df['Fiscal Year'].unique())
    actual_combinations = len(final_df)
    print(f"Expected municipality-year combinations: {expected_combinations}")
    print(f"Actual combinations: {actual_combinations}")
    
    print(f"\nColumns in final dataset:")
    for i, col in enumerate(final_df.columns, 1):
        print(f"{i:2d}. {col}")
    
    # Show sample of data
    print(f"\nSample of final data:")
    print(final_df[['Municipality', 'Fiscal Year', 'exp_Education', 'rev_Taxes']].head(10))
    
    print(f"\nData saved to: {output_file}")
    print("Script completed successfully!")

if __name__ == "__main__":
    main()
