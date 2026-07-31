import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject} from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private hubConnection!: signalR.HubConnection;
  
  // Canlı gelen mesajları ekrana anında yansıtmak için bir dinleyici (Observable) oluşturuyoruz
  public messages$ = new BehaviorSubject<any[]>([]);
  public onMessageReceived$ = new Subject<any>(); // 🚀 YENİ: Anlık bildirim rozeti için dinleyici
  
  // 🚨 Kendi backend portuna göre burayı düzenle!
  private apiUrl = 'https://localhost:7167/api/chat'; 
  private hubUrl = 'https://localhost:7167/chatHub';

  constructor(private http: HttpClient) {}

  // 1. SIGNALR BAĞLANTISINI BAŞLATMA
  // Bu metodu, kullanıcı login olup sisteme girdiğinde (örneğin Dashboard açıldığında) çağıracağız.
  public startConnection(userId: string) {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.hubUrl}?userId=${userId}`) // Backend'e kimin bağlandığını söylüyoruz
      .withAutomaticReconnect() // İnternet koparsa otomatik tekrar bağlanmaya çalışır
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('🚀 SignalR Canlı Sohbet Bağlantısı Başarılı!'))
      .catch(err => console.log('SignalR Bağlanırken Hata: ', err));

    // Backend'den "ReceiveMessage" adıyla bir mesaj fırlatıldığında burası tetiklenir
    this.hubConnection.on('ReceiveMessage', (message: any) => {
      // Gelen yeni mesajı, mevcut mesaj listesinin sonuna ekle
      const currentMessages = this.messages$.getValue();
      this.messages$.next([...currentMessages, message]);
      this.onMessageReceived$.next(message); // 🚀 YENİ: Mesaj geldiğinde diğer bileşenlere haber ver
    });
  }

  // 2. MESAJ GÖNDERME
  public sendMessage(senderId: number, receiverId: number, content: string) {
    // Backend'deki "ChatHub.cs" içindeki "SendMessage" metodunu tetikler
    return this.hubConnection.invoke('SendMessage', senderId, receiverId, content);
  }

  // 3. GEÇMİŞ MESAJLARI GETİRME
  public getMessageHistory(userId: number, contactId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/history/${userId}/${contactId}`);
  }

  public deleteMessageForMe(messageId: number, userId: number) {
    return this.http.delete(`${this.apiUrl}/${messageId}/delete-for-me/${userId}`);
  }

public clearChatHistory(userId: number, contactId: number) {
    return this.http.delete(`${this.apiUrl}/clear-chat/${userId}/${contactId}`);
  }

  public getAllUserMessages(userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/all-messages/${userId}`);
  }

  

}