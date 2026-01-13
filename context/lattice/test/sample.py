"""
Sample Python module for testing the parser.
Contains various Python constructs for comprehensive parsing.
"""

import os
import sys
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from pathlib import Path
from .services import UserService, AuthService
from ..utils import helpers as utils
import requests


@dataclass
class User:
    """User data model."""
    id: int
    name: str
    email: str
    role: str = "user"


class UserController:
    """
    Controller for user-related operations.
    Handles HTTP requests for user management.
    """
    
    def __init__(self, user_service: UserService, auth_service: AuthService):
        """Initialize the controller with required services."""
        self.user_service = user_service
        self.auth_service = auth_service
        self._cache: Dict[str, Any] = {}
    
    async def get_user(self, request, response) -> Optional[Dict]:
        """
        Get user by ID.
        
        Args:
            request: The HTTP request object
            response: The HTTP response object
            
        Returns:
            User data dictionary or None if not found
        """
        user_id = request.params.get('id')
        user = await self.user_service.find_by_id(user_id)
        
        if not user:
            response.status(404).json({'error': 'User not found'})
            return None
        
        return response.json({'success': True, 'data': user})
    
    async def create_user(self, request, response) -> Dict:
        """Create a new user."""
        data = request.body
        name = data.get('name')
        email = data.get('email')
        role = data.get('role', 'user')
        
        if not self._validate_email(email):
            response.status(400).json({'error': 'Invalid email'})
            return None
        
        user = await self.user_service.create({
            'name': name,
            'email': email,
            'role': role
        })
        
        return response.status(201).json({'success': True, 'data': user})
    
    def _validate_email(self, email: str) -> bool:
        """Validate email format."""
        import re
        pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        return bool(re.match(pattern, email))
    
    @staticmethod
    def format_user_response(user: User) -> Dict:
        """Format user object for API response."""
        return {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'role': user.role
        }
    
    @property
    def cache_size(self) -> int:
        """Get current cache size."""
        return len(self._cache)


class DataUtils:
    """Utility functions for data processing."""
    
    @staticmethod
    def array_to_map(arr: List[Dict], key: str) -> Dict[str, Dict]:
        """Transform array to map by key."""
        result = {}
        for item in arr:
            result[str(item[key])] = item
        return result
    
    @staticmethod
    def deep_clone(obj: Any) -> Any:
        """Deep clone an object."""
        import json
        return json.loads(json.dumps(obj))


async def initialize_database(connection_string: str) -> bool:
    """
    Initialize database connection.
    
    Args:
        connection_string: Database connection URL
        
    Returns:
        True if connection successful, False otherwise
    """
    import asyncio
    try:
        print('Connecting to database...')
        await asyncio.sleep(1)
        print('Database connected')
        return True
    except Exception as error:
        print(f'Database connection failed: {error}')
        return False


async def fetch_external_data(endpoint: str) -> Any:
    """Fetch data from external API."""
    response = requests.get(endpoint)
    return response.json()


def calculate_total(items: List[int]) -> int:
    """Calculate sum of items."""
    return sum(items)


def format_currency(amount: float, currency: str = 'USD') -> str:
    """Format number as currency string."""
    symbols = {'USD': '$', 'EUR': '€', 'GBP': '£'}
    symbol = symbols.get(currency, currency)
    return f'{symbol}{amount:,.2f}'


@property
def config_path() -> Path:
    """Get configuration file path."""
    return Path.home() / '.config' / 'app'


if __name__ == '__main__':
    import asyncio
    
    async def main():
        success = await initialize_database('postgresql://localhost/mydb')
        if success:
            print('Application started')
    
    asyncio.run(main())
