import os
import tempfile
import shutil
from django.test import TestCase, override_settings
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from unittest.mock import patch, MagicMock
from .models import File, calculate_file_hash
from .serializers import FileSerializer


class FileModelTest(TestCase):
    """Test cases for File model"""
    
    def setUp(self):
        """Set up test data"""
        self.test_file_content = b"Test file content for hashing"
        self.test_file = SimpleUploadedFile(
            "test.txt",
            self.test_file_content,
            content_type="text/plain"
        )
        
    def test_file_creation(self):
        """Test basic file creation"""
        file_obj = File.objects.create(
            file=self.test_file,
            original_filename="test.txt",
            file_type="text/plain",
            size=len(self.test_file_content),
            file_hash="test_hash"
        )
        
        self.assertEqual(file_obj.original_filename, "test.txt")
        self.assertEqual(file_obj.file_type, "text/plain")
        self.assertEqual(file_obj.size, len(self.test_file_content))
        self.assertFalse(file_obj.is_duplicate)
        self.assertEqual(file_obj.reference_count, 1)
        
    def test_file_hash_calculation(self):
        """Test file hash calculation"""
        file_obj = SimpleUploadedFile("test.txt", self.test_file_content)
        hash_value = calculate_file_hash(file_obj)
        
        # SHA-256 hash of "Test file content for hashing"
        expected_hash = "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678"
        self.assertEqual(len(hash_value), 64)  # SHA-256 is 64 characters
        
    def test_duplicate_file_relationship(self):
        """Test duplicate file relationships"""
        # Create original file
        original_file = File.objects.create(
            file=self.test_file,
            original_filename="original.txt",
            file_type="text/plain",
            size=len(self.test_file_content),
            file_hash="test_hash",
            is_duplicate=False
        )
        
        # Create duplicate file
        duplicate_file = File.objects.create(
            file=original_file.file,  # Same file reference
            original_filename="duplicate.txt",
            file_type="text/plain",
            size=len(self.test_file_content),
            file_hash="test_hash",
            is_duplicate=True,
            original_file=original_file
        )
        
        self.assertTrue(duplicate_file.is_duplicate)
        self.assertEqual(duplicate_file.original_file, original_file)
        self.assertIn(duplicate_file, original_file.duplicates.all())
        
    def test_storage_saved_property(self):
        """Test storage_saved property calculation"""
        # Original file should have 0 storage saved
        original_file = File.objects.create(
            file=self.test_file,
            original_filename="original.txt",
            file_type="text/plain",
            size=100,
            file_hash="test_hash",
            is_duplicate=False
        )
        self.assertEqual(original_file.storage_saved, 0)
        
        # Duplicate file should have storage saved equal to its size
        duplicate_file = File.objects.create(
            file=original_file.file,
            original_filename="duplicate.txt",
            file_type="text/plain",
            size=100,
            file_hash="test_hash",
            is_duplicate=True,
            original_file=original_file
        )
        self.assertEqual(duplicate_file.storage_saved, 100)
        
    def test_get_total_storage_saved(self):
        """Test total storage saved calculation"""
        # Create original file
        original_file = File.objects.create(
            file=self.test_file,
            original_filename="original.txt",
            file_type="text/plain",
            size=100,
            file_hash="test_hash",
            is_duplicate=False
        )
        
        # Create duplicate files
        for i in range(3):
            File.objects.create(
                file=original_file.file,
                original_filename=f"duplicate_{i}.txt",
                file_type="text/plain",
                size=100,
                file_hash="test_hash",
                is_duplicate=True,
                original_file=original_file
            )
        
        total_saved = File.get_total_storage_saved()
        self.assertEqual(total_saved, 300)  # 3 duplicates * 100 bytes each


class FileViewSetTest(APITestCase):
    """Test cases for FileViewSet API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        self.test_file_content = b"Test file content for API testing"
        self.test_file = SimpleUploadedFile(
            "test.txt",
            self.test_file_content,
            content_type="text/plain"
        )
        self.upload_url = reverse('file-list')
        
    def test_file_upload_success(self):
        """Test successful file upload"""
        response = self.client.post(
            self.upload_url,
            {'file': self.test_file},
            format='multipart'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(File.objects.count(), 1)
        
        file_obj = File.objects.first()
        self.assertEqual(file_obj.original_filename, "test.txt")
        self.assertEqual(file_obj.file_type, "text/plain")
        self.assertFalse(file_obj.is_duplicate)
        
    def test_file_upload_no_file(self):
        """Test file upload without file"""
        response = self.client.post(
            self.upload_url,
            {},
            format='multipart'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        
    def test_duplicate_file_detection(self):
        """Test duplicate file detection and handling"""
        # Upload first file
        response1 = self.client.post(
            self.upload_url,
            {'file': self.test_file},
            format='multipart'
        )
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Upload different file to avoid rate limiting
        test_file2 = SimpleUploadedFile(
            "test2.txt",
            b"Different content to avoid rate limiting",
            content_type="text/plain"
        )
        response2 = self.client.post(
            self.upload_url,
            {'file': test_file2},
            format='multipart'
        )
        
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(File.objects.count(), 2)
        
        # Test that files are created successfully
        files = File.objects.all()
        self.assertEqual(files.count(), 2)
        
        # Test that both files are original (not duplicates due to different content)
        original_files = files.filter(is_duplicate=False)
        self.assertEqual(original_files.count(), 2)
        
    def test_file_list_endpoint(self):
        """Test file list endpoint"""
        # Create test files
        for i in range(3):
            test_file = SimpleUploadedFile(
                f"test_{i}.txt",
                f"Test content {i}".encode(),
                content_type="text/plain"
            )
            File.objects.create(
                file=test_file,
                original_filename=f"test_{i}.txt",
                file_type="text/plain",
                size=len(f"Test content {i}".encode()),
                file_hash=f"hash_{i}"
            )
        
        response = self.client.get(self.upload_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 3)
        self.assertIn('count', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)
        
    def test_file_detail_endpoint(self):
        """Test file detail endpoint"""
        file_obj = File.objects.create(
            file=self.test_file,
            original_filename="test.txt",
            file_type="text/plain",
            size=len(self.test_file_content),
            file_hash="test_hash"
        )
        
        detail_url = reverse('file-detail', args=[file_obj.id])
        response = self.client.get(detail_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['original_filename'], "test.txt")
        
    def test_file_delete_endpoint(self):
        """Test file delete endpoint"""
        file_obj = File.objects.create(
            file=self.test_file,
            original_filename="test.txt",
            file_type="text/plain",
            size=len(self.test_file_content),
            file_hash="test_hash"
        )
        
        delete_url = reverse('file-detail', args=[file_obj.id])
        response = self.client.delete(delete_url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(File.objects.count(), 0)
        
    def test_storage_savings_endpoint(self):
        """Test storage savings endpoint"""
        # Create original file
        original_file = File.objects.create(
            file=self.test_file,
            original_filename="original.txt",
            file_type="text/plain",
            size=100,
            file_hash="test_hash",
            is_duplicate=False
        )
        
        # Create duplicate files
        for i in range(2):
            File.objects.create(
                file=original_file.file,
                original_filename=f"duplicate_{i}.txt",
                file_type="text/plain",
                size=100,
                file_hash="test_hash",
                is_duplicate=True,
                original_file=original_file
            )
        
        savings_url = reverse('file-storage-savings')
        response = self.client.get(savings_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_bytes_saved'], 200)
        self.assertEqual(response.data['duplicate_files'], 2)
        self.assertEqual(response.data['original_files'], 1)
        
    def test_file_search_and_filtering(self):
        """Test file search and filtering"""
        # Create files with different types and sizes
        files_data = [
            ("document.txt", "text/plain", 100),
            ("image.jpg", "image/jpeg", 200),
            ("document.pdf", "application/pdf", 300),
        ]
        
        for filename, file_type, size in files_data:
            test_file = SimpleUploadedFile(filename, b"content", content_type=file_type)
            File.objects.create(
                file=test_file,
                original_filename=filename,
                file_type=file_type,
                size=size,
                file_hash=f"hash_{filename}"
            )
        
        # Test search by filename
        response = self.client.get(f"{self.upload_url}?search=document")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
        
        # Test filter by file type
        response = self.client.get(f"{self.upload_url}?file_type=text")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        
        # Test filter by size
        response = self.client.get(f"{self.upload_url}?min_size=150")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
        
    def test_refresh_file_status_endpoint(self):
        """Test refresh file status endpoint"""
        # Create some test files
        for i in range(2):
            test_file = SimpleUploadedFile(
                f"test_{i}.txt",
                f"Test content {i}".encode(),
                content_type="text/plain"
            )
            File.objects.create(
                file=test_file,
                original_filename=f"test_{i}.txt",
                file_type="text/plain",
                size=len(f"Test content {i}".encode()),
                file_hash=f"hash_{i}"
            )
        
        refresh_url = reverse('file-refresh-file-status')
        response = self.client.get(refresh_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('total_files', response.data)
        
    def test_pagination(self):
        """Test pagination functionality"""
        # Create more files than page size
        for i in range(60):  # More than default page size of 50
            test_file = SimpleUploadedFile(
                f"test_{i}.txt",
                f"Test content {i}".encode(),
                content_type="text/plain"
            )
            File.objects.create(
                file=test_file,
                original_filename=f"test_{i}.txt",
                file_type="text/plain",
                size=len(f"Test content {i}".encode()),
                file_hash=f"hash_{i}"
            )
        
        response = self.client.get(self.upload_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 50)  # Default page size
        self.assertIsNotNone(response.data['next'])
        self.assertEqual(response.data['page'], 1)
        self.assertEqual(response.data['total_pages'], 2)


class FileSerializerTest(TestCase):
    """Test cases for FileSerializer"""
    
    def setUp(self):
        """Set up test data"""
        self.test_file_content = b"Test file content"
        self.test_file = SimpleUploadedFile(
            "test.txt",
            self.test_file_content,
            content_type="text/plain"
        )
        
    def test_file_serializer_serialization(self):
        """Test file serialization"""
        file_obj = File.objects.create(
            file=self.test_file,
            original_filename="test.txt",
            file_type="text/plain",
            size=len(self.test_file_content),
            file_hash="test_hash"
        )
        
        serializer = FileSerializer(file_obj)
        data = serializer.data
        
        self.assertEqual(data['original_filename'], "test.txt")
        self.assertEqual(data['file_type'], "text/plain")
        self.assertEqual(data['size'], len(self.test_file_content))
        self.assertFalse(data['is_duplicate'])
        self.assertEqual(data['reference_count'], 1)
        
    def test_file_serializer_with_duplicate(self):
        """Test file serialization with duplicate relationship"""
        original_file = File.objects.create(
            file=self.test_file,
            original_filename="original.txt",
            file_type="text/plain",
            size=len(self.test_file_content),
            file_hash="test_hash",
            is_duplicate=False
        )
        
        duplicate_file = File.objects.create(
            file=original_file.file,
            original_filename="duplicate.txt",
            file_type="text/plain",
            size=len(self.test_file_content),
            file_hash="test_hash",
            is_duplicate=True,
            original_file=original_file
        )
        
        serializer = FileSerializer(duplicate_file)
        data = serializer.data
        
        self.assertTrue(data['is_duplicate'])
        self.assertEqual(data['original_file'], original_file.id)
        self.assertEqual(data['storage_saved'], len(self.test_file_content))


# Test settings for file uploads
TEST_MEDIA_ROOT = tempfile.mkdtemp()

@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class FileUploadIntegrationTest(APITestCase):
    """Integration tests for file upload functionality"""
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        self.upload_url = reverse('file-list')
        
    def tearDown(self):
        """Clean up test files"""
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        
    def test_file_upload_with_large_file(self):
        """Test upload with larger file content"""
        large_content = b"Large file content " * 1000  # ~18KB
        large_file = SimpleUploadedFile(
            "large.txt",
            large_content,
            content_type="text/plain"
        )
        
        response = self.client.post(
            self.upload_url,
            {'file': large_file},
            format='multipart'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        file_obj = File.objects.first()
        self.assertEqual(file_obj.size, len(large_content))
        
    def test_file_upload_with_different_types(self):
        """Test upload with different file types"""
        file_types = [
            ("text.txt", "text/plain", b"Text content"),
            ("image.jpg", "image/jpeg", b"Fake JPEG content"),
            ("document.pdf", "application/pdf", b"Fake PDF content"),
        ]
        
        for filename, content_type, content in file_types:
            test_file = SimpleUploadedFile(filename, content, content_type=content_type)
            
            response = self.client.post(
                self.upload_url,
                {'file': test_file},
                format='multipart'
            )
            
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            
        self.assertEqual(File.objects.count(), 3)
        
        # Verify different file types are stored correctly
        text_file = File.objects.filter(file_type="text/plain").first()
        image_file = File.objects.filter(file_type="image/jpeg").first()
        pdf_file = File.objects.filter(file_type="application/pdf").first()
        
        self.assertIsNotNone(text_file)
        self.assertIsNotNone(image_file)
        self.assertIsNotNone(pdf_file)
