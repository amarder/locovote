#!/usr/bin/env python3
"""
Script to examine and clean municipality data from processed arrow files.
This script reads all arrow files in ../data/processed and provides information about their contents.
"""

import pandas as pd
import os
import glob
from pathlib import Path
import pyarrow.feather as feather

def examine_arrow_file(file_path):
    """Examine a single arrow file and print information about its contents"""
    try:
        print(f"\n{'='*80}")
        print(f"FILE: {os.path.basename(file_path)}")
        print(f"PATH: {file_path}")
        print(f"{'='*80}")
        
        # Read the arrow file
        df = pd.read_feather(file_path)
        
        # Basic information
        print(f"SHAPE: {df.shape[0]:,} rows × {df.shape[1]} columns")
        print(f"MEMORY USAGE: {df.memory_usage(deep=True).sum() / 1024**2:.2f} MB")
        
        # Column information
        print(f"\nCOLUMNS ({len(df.columns)}):")
        for i, col in enumerate(df.columns, 1):
            non_null_count = df[col].count()
            null_count = len(df) - non_null_count
            dtype = str(df[col].dtype)
            print(f"  {i:2d}. {col:30s} | {dtype:15s} | {non_null_count:,} non-null, {null_count:,} null")
        
        # Data types summary
        print(f"\nDATA TYPES SUMMARY:")
        dtype_counts = df.dtypes.value_counts()
        for dtype, count in dtype_counts.items():
            print(f"  {dtype}: {count} columns")
        
        # Check for key identifier columns
        key_columns = ['Municipality', 'Fiscal Year', 'DOR Code', 'Year']
        found_keys = [col for col in key_columns if col in df.columns]
        if found_keys:
            print(f"\nKEY IDENTIFIER COLUMNS FOUND: {found_keys}")
            for col in found_keys:
                unique_count = df[col].nunique()
                print(f"  {col}: {unique_count:,} unique values")
                if unique_count <= 10:
                    values = sorted(df[col].unique())
                    print(f"    Values: {values}")
        
        # Sample data
        print(f"\nSAMPLE DATA (first 5 rows):")
        # Show only first few columns if there are many
        display_cols = list(df.columns[:10]) if len(df.columns) > 10 else list(df.columns)
        sample_df = df[display_cols].head()
        print(sample_df.to_string(index=True))
        
        if len(df.columns) > 10:
            print(f"\n... and {len(df.columns) - 10} more columns")
        
        # Missing data summary
        missing_data = df.isnull().sum()
        missing_data = missing_data[missing_data > 0].sort_values(ascending=False)
        if len(missing_data) > 0:
            print(f"\nMISSING DATA:")
            for col, missing_count in missing_data.head(10).items():
                pct_missing = (missing_count / len(df)) * 100
                print(f"  {col:30s}: {missing_count:,} ({pct_missing:.1f}%)")
            if len(missing_data) > 10:
                print(f"  ... and {len(missing_data) - 10} more columns with missing data")
        else:
            print(f"\n✓ NO MISSING DATA")
        
        # Summary statistics for numeric columns
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) > 0:
            print(f"\nNUMERIC COLUMNS SUMMARY ({len(numeric_cols)} columns):")
            # Show summary for first few numeric columns
            display_numeric = list(numeric_cols[:5])
            summary = df[display_numeric].describe()
            print(summary.to_string())
            if len(numeric_cols) > 5:
                print(f"\n... and {len(numeric_cols) - 5} more numeric columns")
        
        return df
        
    except Exception as e:
        print(f"ERROR reading {file_path}: {e}")
        return None

def merge_all_datasets():
    """Merge all datasets together with appropriate prefixes"""
    
    # Define paths
    data_dir = Path('../data/processed')
    output_file = '../data/processed/municipalities.arrow'
    
    print(f"Loading and merging datasets...")
    
    # Load each dataset
    general_fund_df = pd.read_feather(data_dir / 'combined_general_fund.arrow')
    population_df = pd.read_feather(data_dir / 'population.arrow')
    tax_rates_df = pd.read_feather(data_dir / 'tax-rates.arrow')
    tax_levies_df = pd.read_feather(data_dir / 'tax-levies.arrow')
    
    print(f"Loaded datasets:")
    print(f"  General fund: {general_fund_df.shape}")
    print(f"  Population: {population_df.shape}")
    print(f"  Tax rates: {tax_rates_df.shape}")
    print(f"  Tax levies: {tax_levies_df.shape}")
    
    # 1. Rename "Year" to "Fiscal Year" in population data
    population_df = population_df.rename(columns={'Year': 'Fiscal Year'})
    print(f"✓ Renamed 'Year' to 'Fiscal Year' in population data")
    
    # 2. Add prefixes to columns (excluding merge keys)
    merge_keys = ['DOR Code', 'Municipality', 'Fiscal Year']
    
    # General fund: add gf_ prefix (and drop source file columns)
    general_fund_df = general_fund_df.drop(columns=['source_file_exp', 'source_file_rev'], errors='ignore')
    gf_columns = {col: f'gf_{col}' for col in general_fund_df.columns if col not in merge_keys}
    general_fund_df = general_fund_df.rename(columns=gf_columns)
    
    # Population: add pop_ prefix
    pop_columns = {col: f'pop_{col}' for col in population_df.columns if col not in merge_keys}
    population_df = population_df.rename(columns=pop_columns)
    
    # Tax rates: add rate_ prefix
    rate_columns = {col: f'rate_{col}' for col in tax_rates_df.columns if col not in merge_keys}
    tax_rates_df = tax_rates_df.rename(columns=rate_columns)
    
    # Tax levies: add levy_ prefix
    levy_columns = {col: f'levy_{col}' for col in tax_levies_df.columns if col not in merge_keys}
    tax_levies_df = tax_levies_df.rename(columns=levy_columns)
    
    print(f"✓ Added prefixes to all datasets")
    
    # 3. Check for the mystery 352nd municipality
    print(f"\nInvestigating municipality differences:")
    gf_munis = set(general_fund_df['Municipality'].unique())
    pop_munis = set(population_df['Municipality'].unique())
    rate_munis = set(tax_rates_df['Municipality'].unique())
    levy_munis = set(tax_levies_df['Municipality'].unique())
    
    print(f"  General fund: {len(gf_munis)} municipalities")
    print(f"  Population: {len(pop_munis)} municipalities")
    print(f"  Tax rates: {len(rate_munis)} municipalities")  
    print(f"  Tax levies: {len(levy_munis)} municipalities")
    
    # Find municipalities that exist in some datasets but not others
    all_munis = gf_munis | pop_munis | rate_munis | levy_munis
    
    missing_from_gf = all_munis - gf_munis
    missing_from_pop = all_munis - pop_munis
    missing_from_rates = all_munis - rate_munis
    missing_from_levies = all_munis - levy_munis
    
    if missing_from_gf:
        print(f"  Missing from general fund: {missing_from_gf}")
    if missing_from_pop:
        print(f"  Missing from population: {missing_from_pop}")
    if missing_from_rates:
        print(f"  Missing from tax rates: {missing_from_rates}")
    if missing_from_levies:
        print(f"  Missing from tax levies: {missing_from_levies}")
    
    # 4. Merge all datasets using outer joins
    print(f"\nMerging datasets...")
    
    # Start with general fund as base
    merged_df = general_fund_df.copy()
    print(f"  Starting with general fund: {merged_df.shape}")
    
    # Merge with population
    merged_df = pd.merge(merged_df, population_df, on=merge_keys, how='outer')
    print(f"  After adding population: {merged_df.shape}")
    
    # Merge with tax rates
    merged_df = pd.merge(merged_df, tax_rates_df, on=merge_keys, how='outer')
    print(f"  After adding tax rates: {merged_df.shape}")
    
    # Merge with tax levies
    merged_df = pd.merge(merged_df, tax_levies_df, on=merge_keys, how='outer')
    print(f"  After adding tax levies: {merged_df.shape}")
    
    # 5. Clean up and sort
    merged_df = merged_df.sort_values(['Municipality', 'Fiscal Year'])
    
    # 6. Summary of merged data
    print(f"\n{'='*80}")
    print(f"MERGED DATASET SUMMARY")
    print(f"{'='*80}")
    print(f"Final shape: {merged_df.shape}")
    print(f"Municipalities: {merged_df['Municipality'].nunique()}")
    print(f"Year range: {merged_df['Fiscal Year'].min():.0f} - {merged_df['Fiscal Year'].max():.0f}")
    
    # Check data coverage by dataset
    print(f"\nData coverage by source:")
    gf_coverage = merged_df['gf_exp_Education'].notna().sum()
    pop_coverage = merged_df['pop_Population'].notna().sum()
    rate_coverage = merged_df['rate_Residential'].notna().sum()
    levy_coverage = merged_df['levy_Residential Levy'].notna().sum()
    
    print(f"  General fund data: {gf_coverage:,} rows ({gf_coverage/len(merged_df)*100:.1f}%)")
    print(f"  Population data: {pop_coverage:,} rows ({pop_coverage/len(merged_df)*100:.1f}%)")
    print(f"  Tax rate data: {rate_coverage:,} rows ({rate_coverage/len(merged_df)*100:.1f}%)")
    print(f"  Tax levy data: {levy_coverage:,} rows ({levy_coverage/len(merged_df)*100:.1f}%)")
    
    # Show missing data summary
    print(f"\nMissing data summary:")
    missing_data = merged_df.isnull().sum()
    missing_data = missing_data[missing_data > 0].sort_values(ascending=False)
    for col, missing_count in missing_data.head(10).items():
        pct_missing = (missing_count / len(merged_df)) * 100
        print(f"  {col:30s}: {missing_count:,} ({pct_missing:.1f}%)")
    
    # 7. Save merged dataset
    print(f"\nSaving merged dataset to {output_file}...")
    merged_df.to_feather(output_file, compression="uncompressed")
    
    print(f"✓ Merged dataset saved successfully!")
    return merged_df

def main():
    """Main function to examine all arrow files and merge them"""
    
    # Define the data directory
    data_dir = Path('../data/processed')
    
    if not data_dir.exists():
        print(f"ERROR: Data directory {data_dir} does not exist")
        return
    
    # Find all arrow files
    arrow_files = sorted(glob.glob(str(data_dir / '*.arrow'))) + sorted(glob.glob(str(data_dir / '*.feather')))
    
    if not arrow_files:
        print(f"No arrow/feather files found in {data_dir}")
        return
    
    print(f"Found {len(arrow_files)} arrow/feather files in {data_dir}")
    
    # Store dataframes for potential analysis
    dataframes = {}
    
    # Examine each file
    for file_path in arrow_files:
        df = examine_arrow_file(file_path)
        if df is not None:
            filename = os.path.basename(file_path)
            dataframes[filename] = df
    
    # Summary across all files
    if dataframes:
        print(f"\n{'='*80}")
        print(f"SUMMARY ACROSS ALL FILES")
        print(f"{'='*80}")
        
        total_rows = sum(len(df) for df in dataframes.values())
        total_cols = sum(len(df.columns) for df in dataframes.values())
        
        print(f"Total files processed: {len(dataframes)}")
        print(f"Total rows across all files: {total_rows:,}")
        print(f"Total columns across all files: {total_cols:,}")
        
        # Check for common columns across files
        if len(dataframes) > 1:
            all_columns = set()
            for df in dataframes.values():
                all_columns.update(df.columns)
            
            common_columns = set(list(dataframes.values())[0].columns)
            for df in list(dataframes.values())[1:]:
                common_columns &= set(df.columns)
            
            print(f"\nCommon columns across all files ({len(common_columns)}):")
            for col in sorted(common_columns):
                print(f"  - {col}")
            
            unique_to_files = all_columns - common_columns
            if unique_to_files:
                print(f"\nColumns unique to specific files ({len(unique_to_files)}):")
                for col in sorted(unique_to_files):
                    files_with_col = [name for name, df in dataframes.items() if col in df.columns]
                    print(f"  - {col}: {files_with_col}")
    
    # Now merge all the datasets
    print(f"\n{'='*80}")
    print(f"MERGING ALL DATASETS")
    print(f"{'='*80}")
    
    merged_df = merge_all_datasets()
    
    # Show sample of merged data
    if merged_df is not None:
        print(f"\nSample of merged data:")
        sample_cols = ['Municipality', 'Fiscal Year', 'pop_Population', 'gf_exp_Education', 'rate_Residential', 'levy_Residential Levy']
        available_cols = [col for col in sample_cols if col in merged_df.columns]
        print(merged_df[available_cols].head(10).to_string(index=False))

if __name__ == "__main__":
    main() 