from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="logstack",
    version="1.0.1",
    author="Mosesedem",
    author_email="team@logstack.tech",
    description="A Python SDK for the Logstack logging platform",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Mosesedem/logstack",
    license="MIT",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.7",
    install_requires=[
        "requests>=2.28.0",
    ],
    extras_require={
        "django": ["django>=3.2"],
        "fastapi": ["fastapi>=0.95.0"],
        "async": ["aiohttp>=3.8.0"],
    },
)
