#!/usr/bin/env python3
"""Clean and validate tax levy data."""

import pandas as pd
import numpy as np
from pathlib import Path

def clean_tax_levies_data(input_path, output_path):
    """
    Read tax levy data from Excel, validate calculations,
    remove calculated columns, and save as Arrow file.
    """
    
    # Create output directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"Reading tax levy data from {input_path}")
    
    # Read the Excel file, keeping DOR Code as string to preserve leading zeros
    df = pd.read_excel(input_path, dtype={'DOR Code': str})
    
    # Clean up column names by removing trailing spaces
    df.columns = df.columns.str.strip()
    
    print(f"Original data shape: {df.shape}")
    print(f"Columns (after cleaning): {list(df.columns)}")
    print(f"DOR Code data type: {df['DOR Code'].dtype}")
    
    # Display sample DOR Codes to verify leading zeros are preserved
    print(f"Sample DOR Codes: {df['DOR Code'].head().tolist()}")
    
    # Define the levy columns (excluding calculated columns)
    levy_columns = [
        'Residential Levy', 
        'Open Space Levy', 
        'Commercial Levy', 
        'Industrial Levy', 
        'Personal Property Levy'
    ]
    
    # Define calculated columns to be removed
    calculated_columns = [
        'Total Levy',
        'RO Levy as a % of Total',
        'CIP Levy as a % of Total'
    ]
    
    print(f"Levy columns: {levy_columns}")
    print(f"Calculated columns to validate and remove: {calculated_columns}")
    
    # Check 1: Validate that "Total Levy" is the sum of all other levy columns
    print("\nValidation 1: Checking Total Levy calculation...")
    calculated_total = df[levy_columns].sum(axis=1)
    total_diff = abs(df['Total Levy'] - calculated_total)
    
    # Allow for small floating point differences (tolerance of 0.01)
    tolerance = 0.01
    total_check_failed = total_diff > tolerance
    
    if total_check_failed.any():
        print(f"ERROR: Total Levy validation failed for {total_check_failed.sum()} rows")
        print("Sample failing rows:")
        failing_rows = df[total_check_failed][['DOR Code', 'Municipality', 'Fiscal Year', 'Total Levy']].head()
        failing_calculated = calculated_total[total_check_failed].head()
        for idx, (_, row) in enumerate(failing_rows.iterrows()):
            calc_val = failing_calculated.iloc[idx]
            print(f"  {row['DOR Code']} {row['Municipality']} {row['Fiscal Year']}: "
                  f"Expected {calc_val:.2f}, Got {row['Total Levy']:.2f}")
        raise ValueError("Total Levy validation failed")
    else:
        print(f"✓ Total Levy validation passed for all {len(df)} rows")
    
    # Check 2: Validate "RO Levy as a % of Total"
    print("\nValidation 2: Checking RO Levy percentage calculation...")
    ro_levy_sum = df['Residential Levy'] + df['Open Space Levy']
    calculated_ro_pct = (ro_levy_sum / df['Total Levy']) * 100
    
    # Handle division by zero cases
    valid_total = df['Total Levy'] != 0
    ro_pct_diff = abs(df.loc[valid_total, 'RO Levy as a % of Total'] - calculated_ro_pct[valid_total])
    ro_check_failed = ro_pct_diff > tolerance
    
    if ro_check_failed.any():
        print(f"ERROR: RO Levy percentage validation failed for {ro_check_failed.sum()} rows")
        print("Sample failing rows:")
        failing_indices = ro_pct_diff[ro_check_failed].index[:5]
        for idx in failing_indices:
            row = df.loc[idx]
            calc_val = calculated_ro_pct.loc[idx]
            print(f"  {row['DOR Code']} {row['Municipality']} {row['Fiscal Year']}: "
                  f"Expected {calc_val:.2f}%, Got {row['RO Levy as a % of Total']:.2f}%")
        raise ValueError("RO Levy percentage validation failed")
    else:
        print(f"✓ RO Levy percentage validation passed for all valid rows")
    
    # Check 3: Validate "CIP Levy as a % of Total"
    print("\nValidation 3: Checking CIP Levy percentage calculation...")
    cip_levy_sum = df['Commercial Levy'] + df['Industrial Levy'] + df['Personal Property Levy']
    calculated_cip_pct = (cip_levy_sum / df['Total Levy']) * 100
    
    cip_pct_diff = abs(df.loc[valid_total, 'CIP Levy as a % of Total'] - calculated_cip_pct[valid_total])
    cip_check_failed = cip_pct_diff > tolerance
    
    if cip_check_failed.any():
        print(f"ERROR: CIP Levy percentage validation failed for {cip_check_failed.sum()} rows")
        print("Sample failing rows:")
        failing_indices = cip_pct_diff[cip_check_failed].index[:5]
        for idx in failing_indices:
            row = df.loc[idx]
            calc_val = calculated_cip_pct.loc[idx]
            print(f"  {row['DOR Code']} {row['Municipality']} {row['Fiscal Year']}: "
                  f"Expected {calc_val:.2f}%, Got {row['CIP Levy as a % of Total']:.2f}%")
        raise ValueError("CIP Levy percentage validation failed")
    else:
        print(f"✓ CIP Levy percentage validation passed for all valid rows")
    
    # All validations passed, remove calculated columns
    print(f"\nAll validations passed! Removing calculated columns: {calculated_columns}")
    df_clean = df.drop(columns=calculated_columns)
    
    # Sort by DOR Code and Fiscal Year for better organization
    df_clean = df_clean.sort_values(['DOR Code', 'Fiscal Year']).reset_index(drop=True)
    
    print(f"Cleaned data shape: {df_clean.shape}")
    print(f"Remaining columns: {list(df_clean.columns)}")
    
    # Display sample of the cleaned data
    print("\nSample of cleaned data:")
    print(df_clean.head(10).values)
    
    # Save as Arrow file
    print(f"\nSaving to {output_path}")
    df_clean.to_feather(output_path, compression="uncompressed")
    
    print("Tax levy data cleaning completed successfully!")
    
    return df_clean

if __name__ == "__main__":
    clean_tax_levies_data(
        input_path=Path("../data/raw/tax_levies_data.xlsx"),
        output_path=Path("../data/processed/tax-levies.arrow")
    ) 