'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            議事録アプリ
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            音声録音から議事録作成までをサポート
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle>議事録作成</CardTitle>
              <CardDescription>新しい議事録を作成して録音を開始</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/setup">
                <Button className="w-full">作成開始</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>既存の議事録</CardTitle>
              <CardDescription>保存された議事録を確認・編集</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled>
                近日公開
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>設定</CardTitle>
              <CardDescription>Google APIなどの設定</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled>
                近日公開
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">
            ブラウザのマイクアクセスを許可してください
          </p>
        </div>
      </div>
    </div>
  );
}