#!/usr/bin/env python3
"""Clean and transform population data from wide to long format."""

import pandas as pd
import re
from pathlib import Path

def clean_population_data(input_path, output_path):
    """
    Read population data from Excel, pivot from wide to long format,
    and save as Arrow file.
    """
    
    # Create output directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"Reading population data from {input_path}")
    
    # Read the Excel file, keeping DOR Code as string to preserve leading zeros
    df = pd.read_excel(input_path, dtype={'DOR Code': str})
    
    print(f"Original data shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"DOR Code data type: {df['DOR Code'].dtype}")
    
    # Display sample DOR Codes to verify leading zeros are preserved
    print(f"Sample DOR Codes: {df['DOR Code'].head().tolist()}")
    
    # Identify year columns (columns that match the pattern [0-9]{4})
    year_pattern = re.compile(r'^[0-9]{4}$')
    year_columns = [col for col in df.columns if year_pattern.match(str(col))]
    
    print(f"Found {len(year_columns)} year columns: {year_columns}")
    
    # Identify non-year columns (ID columns)
    id_columns = [col for col in df.columns if not year_pattern.match(str(col))]
    
    print(f"ID columns: {id_columns}")
    
    # Pivot from wide to long format
    df_long = pd.melt(
        df,
        id_vars=id_columns,
        value_vars=year_columns,
        var_name='Year',
        value_name='Population'
    )
    
    # Convert Year column to integer
    df_long['Year'] = df_long['Year'].astype(int)
    
    # Sort by DOR Code and Year for better organization
    df_long = df_long.sort_values(['DOR Code', 'Year']).reset_index(drop=True)
    
    print(f"Transformed data shape: {df_long.shape}")
    print(f"Year range: {df_long['Year'].min()} - {df_long['Year'].max()}")
    
    # Display sample of the transformed data
    print("\nSample of transformed data:")
    print(df_long.head(10).values)
    
    # Save as Arrow file
    print(f"\nSaving to {output_path}")
    df_long.to_feather(output_path, compression="uncompressed")
    
    print("Population data cleaning completed successfully!")
    
    return df_long

if __name__ == "__main__":
    clean_population_data(
        input_path=Path("../data/raw/population.xlsx"),
        output_path=Path("../data/processed/population.arrow")
    )
