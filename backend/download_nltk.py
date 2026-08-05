"""Run this once to download required NLTK data."""
import nltk
print("Downloading NLTK stopwords...")
nltk.download('stopwords')
print("Downloading NLTK punkt...")
nltk.download('punkt')
nltk.download('punkt_tab')
print("Done!")
