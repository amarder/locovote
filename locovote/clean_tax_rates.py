#!/usr/bin/env python3
"""Clean and process tax rates data."""

import pandas as pd
from pathlib import Path

def clean_tax_rates_data(input_path, output_path):
    """
    Read tax rates data from Excel and save as Arrow file.
    
    Args:
        input_path: Path to the input Excel file
        output_path: Path to save the cleaned Arrow file
    """
    # Create output directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"Reading tax rates data from {input_path}")
    
    # Read the Excel file, keeping DOR Code as string to preserve leading zeros
    df = pd.read_excel(input_path, dtype={'DOR Code': str})
    
    # Clean up column names by removing trailing spaces
    df.columns = df.columns.str.strip()
    
    print(f"Original data shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"DOR Code data type: {df['DOR Code'].dtype}")
    
    # Display sample DOR Codes to verify leading zeros are preserved
    print(f"Sample DOR Codes: {df['DOR Code'].head().tolist()}")
    
    # Sort by DOR Code and Fiscal Year for better organization
    df_clean = df.sort_values(['DOR Code', 'Fiscal Year']).reset_index(drop=True)
    
    print(f"Cleaned data shape: {df_clean.shape}")
    
    # Display sample of the cleaned data
    print("\nSample of cleaned data:")
    print(df_clean.head())
    
    # Save as Arrow file
    print(f"\nSaving to {output_path}")
    df_clean.to_feather(output_path, compression="uncompressed")
    
    print("Tax rates data cleaning completed successfully!")
    
    return df_clean

if __name__ == "__main__":
    clean_tax_rates_data(
        input_path=Path("../data/raw/tax_rates_data.xlsx"),
        output_path=Path("../data/processed/tax-rates.arrow")
    ) 