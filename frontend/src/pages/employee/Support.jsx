import { useState } from 'react';
import { MessageSquare, Send, Phone, Mail, Clock, ChevronRight, HelpCircle, FileText, AlertCircle } from 'lucide-react';
import { Card, Button, Badge } from '../../components/common';

const Support = () => {
  const [message, setMessage] = useState('');

  const tickets = [
    {
      id: 1,
      subject: 'Issue with time clock',
      status: 'open',
      priority: 'high',
      createdAt: '2025-12-18',
      lastUpdate: '2025-12-18',
    },
    {
      id: 2,
      subject: 'Leave balance inquiry',
      status: 'resolved',
      priority: 'low',
      createdAt: '2025-12-10',
      lastUpdate: '2025-12-12',
    },
    {
      id: 3,
      subject: 'Schedule change request',
      status: 'in-progress',
      priority: 'medium',
      createdAt: '2025-12-15',
      lastUpdate: '2025-12-17',
    },
  ];

  const faqs = [
    { question: 'How do I request time off?', answer: 'Navigate to Leave Requests and click "New Request".' },
    { question: 'What if I forget to clock out?', answer: 'Contact support to request a time adjustment.' },
    { question: 'How do I update my profile?', answer: 'Go to Profile settings to update your information.' },
    { question: 'Who approves my timesheets?', answer: 'Your client manager reviews, then Hello Team approves.' },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <Badge variant="warning">Open</Badge>;
      case 'in-progress':
        return <Badge variant="info">In Progress</Badge>;
      case 'resolved':
        return <Badge variant="success">Resolved</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return <Badge variant="danger">High</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium</Badge>;
      case 'low':
        return <Badge variant="default">Low</Badge>;
      default:
        return <Badge variant="default">{priority}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Support</h2>
        <p className="text-gray-500">Get help and contact our support team</p>
      </div>

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-xl">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Live Chat</h3>
              <p className="text-sm text-gray-500">Available 9 AM - 6 PM</p>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-4">
            Start Chat
          </Button>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Phone className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Phone Support</h3>
              <p className="text-sm text-gray-500">1-800-HELLO-TM</p>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-4">
            Call Now
          </Button>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Email</h3>
              <p className="text-sm text-gray-500">support@helloteam.com</p>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-4">
            Send Email
          </Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submit New Ticket */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit a Ticket</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Subject</label>
              <input
                type="text"
                className="input"
                placeholder="Brief description of your issue"
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input">
                <option>Time & Attendance</option>
                <option>Leave & Schedule</option>
                <option>Technical Issue</option>
                <option>Payroll Question</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="label">Message</label>
              <textarea
                className="input min-h-[120px] resize-none"
                placeholder="Describe your issue in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <Button variant="primary" icon={Send} className="w-full">
              Submit Ticket
            </Button>
          </div>
        </Card>

        {/* FAQ */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{faq.question}</p>
                    <p className="text-sm text-gray-500 mt-1">{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* My Tickets */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">My Tickets</h3>
          <Button variant="ghost" size="sm">
            View All
          </Button>
        </div>
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{ticket.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">Updated {ticket.lastUpdate}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getPriorityBadge(ticket.priority)}
                {getStatusBadge(ticket.status)}
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Support;
