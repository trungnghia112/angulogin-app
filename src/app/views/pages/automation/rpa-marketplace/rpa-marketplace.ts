import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

interface RpaTemplate {
    id: string;
    title: string;
    platform: string;
    platformIcon: string;
    platformColor: string;
    description: string;
    usageCount: number;
    isPremium: boolean;
    overview: string;
    steps: string[];
    variables: { name: string; required: boolean; description: string }[];
}

const PLATFORMS = [
    'All', 'Facebook', 'TikTok', 'Twitter/X', 'Instagram',
    'LinkedIn', 'Amazon', 'Shopee', 'Reddit', 'YouTube',
    'Gmail', 'Etsy', 'Mercari', 'Poshmark', 'Other',
];

const PLATFORM_COLORS: Record<string, string> = {
    Facebook: '#1877F2',
    TikTok: '#000000',
    'Twitter/X': '#1DA1F2',
    Instagram: '#E1306C',
    LinkedIn: '#0A66C2',
    Amazon: '#FF9900',
    Shopee: '#EE4D2D',
    Reddit: '#FF4500',
    YouTube: '#FF0000',
    Gmail: '#D44638',
    Etsy: '#F1641E',
    Mercari: '#4DC9F6',
    Poshmark: '#CF0032',
    Other: '#6B7280',
};

const TEMPLATES: RpaTemplate[] = [
    {
        id: 'tiktok-search-like',
        title: 'TikTok Search & Comment Like',
        platform: 'TikTok',
        platformIcon: 'pi-video',
        platformColor: PLATFORM_COLORS['TikTok'],
        description: 'Search videos, browse & random like comments to boost activity.',
        usageCount: 1262,
        isPremium: true,
        overview: 'Visit Home → Search Keywords → Browse Videos → Like Comments by Probability → Screenshot → Loop',
        steps: [
            'Visit TikTok homepage, read the search keywords list',
            'Iterate keywords, input search term to search',
            'Get video list, randomly enter video detail page by set count',
            'Open comment section, calculate whether to like based on probability',
            'Loop like comments by set count, screenshot to save record',
            'Save like data, switch to the next video or keyword to continue',
        ],
        variables: [
            { name: 'searchText', required: true, description: 'Keywords, one topic per line' },
            { name: 'viewVideoCount', required: false, description: 'Videos to browse per search (Default: 3)' },
            { name: 'CommentLikes', required: false, description: 'Comment likes per video (Default: 1)' },
            { name: 'likeRate', required: false, description: 'Like probability 0-10. 10=100% (Default: 7)' },
        ],
    },
    {
        id: 'fb-group-exit',
        title: 'FB Group Exit',
        platform: 'Facebook',
        platformIcon: 'pi-facebook',
        platformColor: PLATFORM_COLORS['Facebook'],
        description: 'Visit Facebook, exit specified groups.',
        usageCount: 4,
        isPremium: true,
        overview: 'Open Facebook → Navigate Groups → Leave Group → Confirm → Loop',
        steps: [
            'Open Facebook and navigate to groups page',
            'Read group URLs from input list',
            'Visit each group and click Leave Group',
            'Confirm leave action',
        ],
        variables: [
            { name: 'groupUrls', required: true, description: 'Group URLs, one per line' },
        ],
    },
    {
        id: 'fb-group-search-join',
        title: 'FB Group Search & Join',
        platform: 'Facebook',
        platformIcon: 'pi-facebook',
        platformColor: PLATFORM_COLORS['Facebook'],
        description: 'Visit Facebook, search groups & auto-join specified number to expand social network.',
        usageCount: 210,
        isPremium: false,
        overview: 'Search Groups → Filter Results → Join Groups → Loop',
        steps: [
            'Open Facebook and navigate to groups search',
            'Input search keywords and filter results',
            'Auto-join groups up to specified count',
            'Wait for confirmation between joins',
        ],
        variables: [
            { name: 'searchKeyword', required: true, description: 'Group search keyword' },
            { name: 'joinCount', required: false, description: 'Number of groups to join (Default: 5)' },
        ],
    },
    {
        id: 'x-like-ai-comment',
        title: 'X Like & AI Comment',
        platform: 'Twitter/X',
        platformIcon: 'pi-twitter',
        platformColor: PLATFORM_COLORS['Twitter/X'],
        description: 'Browse feed, like, use AI to auto-comment, loop to boost activity.',
        usageCount: 439,
        isPremium: true,
        overview: 'Open Feed → Scroll → Like Posts → Generate AI Comment → Post Comment → Loop',
        steps: [
            'Open Twitter/X home feed',
            'Scroll through posts randomly',
            'Like posts based on probability setting',
            'Generate contextual AI comment using Grok',
            'Post comment and move to next post',
            'Loop for specified number of iterations',
        ],
        variables: [
            { name: 'scrollCount', required: false, description: 'Number of posts to scroll (Default: 10)' },
            { name: 'likeRate', required: false, description: 'Like probability 0-10 (Default: 5)' },
            { name: 'commentRate', required: false, description: 'Comment probability 0-10 (Default: 3)' },
        ],
    },
    {
        id: 'fb-friends-counter',
        title: 'FB Friends Counter',
        platform: 'Facebook',
        platformIcon: 'pi-facebook',
        platformColor: PLATFORM_COLORS['Facebook'],
        description: 'Visit Facebook friends page, auto-scroll to load and extract all friends names, save to txt file.',
        usageCount: 13,
        isPremium: true,
        overview: 'Visit Friends Page → Auto Scroll → Extract Names → Save to File',
        steps: [
            'Navigate to Facebook friends page',
            'Auto-scroll to load all friends',
            'Extract friend names and profile links',
            'Save results to text file',
        ],
        variables: [],
    },
    {
        id: 'ig-auto-follow',
        title: 'Instagram Auto Follow',
        platform: 'Instagram',
        platformIcon: 'pi-instagram',
        platformColor: PLATFORM_COLORS['Instagram'],
        description: 'Search hashtags, browse posts, auto-follow users to grow your network.',
        usageCount: 876,
        isPremium: false,
        overview: 'Search Hashtag → Browse Posts → Visit Profile → Follow → Loop',
        steps: [
            'Open Instagram and search for specified hashtag',
            'Browse top/recent posts in the hashtag feed',
            'Visit user profiles from posts',
            'Follow user if not already following',
            'Add random delay between follows',
        ],
        variables: [
            { name: 'hashtags', required: true, description: 'Hashtags to search, one per line' },
            { name: 'followCount', required: false, description: 'Max follows per hashtag (Default: 10)' },
            { name: 'delaySeconds', required: false, description: 'Delay between follows in seconds (Default: 5)' },
        ],
    },
    {
        id: 'amazon-review-scraper',
        title: 'Amazon Review Scraper',
        platform: 'Amazon',
        platformIcon: 'pi-shopping-cart',
        platformColor: PLATFORM_COLORS['Amazon'],
        description: 'Extract product reviews from Amazon listings, save to CSV for analysis.',
        usageCount: 534,
        isPremium: true,
        overview: 'Visit Product → Load Reviews → Paginate → Extract Data → Export CSV',
        steps: [
            'Navigate to Amazon product page',
            'Click on reviews section',
            'Paginate through all reviews',
            'Extract reviewer name, rating, date, comment',
            'Export data to CSV file',
        ],
        variables: [
            { name: 'productUrl', required: true, description: 'Amazon product URL' },
            { name: 'maxPages', required: false, description: 'Max review pages to scrape (Default: 10)' },
        ],
    },
    {
        id: 'shopee-browse-products',
        title: 'Shopee Browse Products',
        platform: 'Shopee',
        platformIcon: 'pi-shopping-bag',
        platformColor: PLATFORM_COLORS['Shopee'],
        description: 'Open Shopee, search keywords, browse products randomly to warm up account.',
        usageCount: 321,
        isPremium: false,
        overview: 'Open Shopee → Search → Browse Products → Add to Cart → Loop',
        steps: [
            'Open shopee.com and log in',
            'Search for specified keywords',
            'Browse product listings randomly',
            'Click into product details',
            'Optionally add to cart',
        ],
        variables: [
            { name: 'searchKeywords', required: true, description: 'Keywords to search, one per line' },
            { name: 'browseCount', required: false, description: 'Products to browse per keyword (Default: 5)' },
        ],
    },
    {
        id: 'linkedin-connect',
        title: 'LinkedIn Auto Connect',
        platform: 'LinkedIn',
        platformIcon: 'pi-linkedin',
        platformColor: PLATFORM_COLORS['LinkedIn'],
        description: 'Search professionals by keyword, send connection requests with personalized notes.',
        usageCount: 1450,
        isPremium: true,
        overview: 'Search People → Visit Profile → Send Connect Request → Add Note → Loop',
        steps: [
            'Open LinkedIn and search for people',
            'Filter by location, industry, or keyword',
            'Visit profile and click Connect',
            'Add personalized connection note',
            'Wait between requests to avoid rate limits',
        ],
        variables: [
            { name: 'searchQuery', required: true, description: 'People search query' },
            { name: 'connectCount', required: false, description: 'Max connections to send (Default: 20)' },
            { name: 'noteTemplate', required: false, description: 'Connection note template (use {name} placeholder)' },
        ],
    },
    {
        id: 'reddit-upvote-comment',
        title: 'Reddit Upvote & Comment',
        platform: 'Reddit',
        platformIcon: 'pi-reddit',
        platformColor: PLATFORM_COLORS['Reddit'],
        description: 'Browse subreddits, upvote posts and leave comments to build karma.',
        usageCount: 198,
        isPremium: false,
        overview: 'Visit Subreddit → Browse Posts → Upvote → Comment → Loop',
        steps: [
            'Navigate to specified subreddit',
            'Browse hot/new posts',
            'Upvote posts based on probability',
            'Leave pre-written comments on posts',
            'Move to next post',
        ],
        variables: [
            { name: 'subreddits', required: true, description: 'Subreddit names, one per line' },
            { name: 'comments', required: true, description: 'Comment pool, one per line (random pick)' },
            { name: 'upvoteRate', required: false, description: 'Upvote probability 0-10 (Default: 7)' },
        ],
    },
    {
        id: 'youtube-watch-subscribe',
        title: 'YouTube Watch & Subscribe',
        platform: 'YouTube',
        platformIcon: 'pi-youtube',
        platformColor: PLATFORM_COLORS['YouTube'],
        description: 'Search videos by keyword, watch for specified duration, like and subscribe.',
        usageCount: 2100,
        isPremium: true,
        overview: 'Search Videos → Watch → Like → Subscribe → Loop',
        steps: [
            'Open YouTube and search for keywords',
            'Click on video from search results',
            'Watch video for specified duration',
            'Like video and subscribe to channel',
            'Move to next search result',
        ],
        variables: [
            { name: 'searchKeywords', required: true, description: 'Video search keywords' },
            { name: 'watchDuration', required: false, description: 'Watch duration in seconds (Default: 30)' },
            { name: 'subscribeRate', required: false, description: 'Subscribe probability 0-10 (Default: 5)' },
        ],
    },
    {
        id: 'gmail-send-bulk',
        title: 'Gmail Bulk Sender',
        platform: 'Gmail',
        platformIcon: 'pi-envelope',
        platformColor: PLATFORM_COLORS['Gmail'],
        description: 'Send personalized emails to a list of recipients using Gmail.',
        usageCount: 756,
        isPremium: true,
        overview: 'Open Gmail → Compose → Fill Template → Send → Loop',
        steps: [
            'Open Gmail and click Compose',
            'Fill in recipient from list',
            'Apply email template with personalization',
            'Send email',
            'Wait between sends to avoid rate limits',
        ],
        variables: [
            { name: 'recipients', required: true, description: 'Email addresses, one per line' },
            { name: 'subject', required: true, description: 'Email subject line' },
            { name: 'bodyTemplate', required: true, description: 'Email body (use {name} for personalization)' },
            { name: 'delaySeconds', required: false, description: 'Delay between sends (Default: 10)' },
        ],
    },
    {
        id: 'etsy-browse-goods',
        title: 'Browse Goods on Etsy',
        platform: 'Etsy',
        platformIcon: 'pi-shopping-bag',
        platformColor: PLATFORM_COLORS['Etsy'],
        description: 'Open www.etsy.com, browse 3 products randomly to warm up your account.',
        usageCount: 3500,
        isPremium: false,
        overview: 'Open Etsy → Browse → Click Products → View Details → Loop',
        steps: [
            'Open etsy.com homepage',
            'Browse product categories',
            'Click on random products',
            'View product details and scroll through images',
        ],
        variables: [
            { name: 'browseCount', required: false, description: 'Number of products to browse (Default: 3)' },
        ],
    },
    {
        id: 'fb-add-friends',
        title: 'FB Add Suggested Friends',
        platform: 'Facebook',
        platformIcon: 'pi-facebook',
        platformColor: PLATFORM_COLORS['Facebook'],
        description: 'Open Facebook, add recommended friends randomly to expand your network.',
        usageCount: 2920,
        isPremium: false,
        overview: 'Visit Suggestions → Add Friends → Scroll → Loop',
        steps: [
            'Open Facebook friend suggestions page',
            'Click Add Friend on suggested profiles',
            'Scroll to load more suggestions',
            'Continue until target count reached',
        ],
        variables: [
            { name: 'addCount', required: false, description: 'Number of friends to add (Default: 3)' },
        ],
    },
    {
        id: 'poshmark-share-listings',
        title: 'Poshmark Auto Share',
        platform: 'Poshmark',
        platformIcon: 'pi-share-alt',
        platformColor: PLATFORM_COLORS['Poshmark'],
        description: 'Automatically share your Poshmark closet listings to boost visibility.',
        usageCount: 890,
        isPremium: false,
        overview: 'Open Closet → Share Listings → Solve Captcha → Loop',
        steps: [
            'Open your Poshmark closet',
            'Iterate through listings',
            'Click Share on each listing',
            'Handle any captcha challenges',
            'Continue to next listing',
        ],
        variables: [
            { name: 'maxShares', required: false, description: 'Max listings to share (Default: all)' },
        ],
    },
];

@Component({
    selector: 'app-rpa-marketplace',
    templateUrl: './rpa-marketplace.html',
    styleUrl: './rpa-marketplace.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [DialogModule, InputTextModule, SelectModule, ButtonModule, FormsModule],
})
export class RpaMarketplace {
    protected readonly platforms = PLATFORMS;
    protected readonly selectedPlatform = signal('All');
    protected readonly searchQuery = signal('');
    protected readonly sortBy = signal('popular');
    protected readonly selectedTemplate = signal<RpaTemplate | null>(null);
    protected readonly detailVisible = signal(false);

    protected readonly sortOptions = [
        { label: 'Most Popular', value: 'popular' },
        { label: 'Most Recent', value: 'recent' },
        { label: 'Name A-Z', value: 'name' },
    ];

    protected readonly filteredTemplates = computed(() => {
        let list = [...TEMPLATES];

        // Filter by platform
        const platform = this.selectedPlatform();
        if (platform !== 'All') {
            list = list.filter(t => t.platform === platform);
        }

        // Filter by search
        const query = this.searchQuery().toLowerCase();
        if (query) {
            list = list.filter(t =>
                t.title.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query)
            );
        }

        // Sort
        const sort = this.sortBy();
        if (sort === 'popular') {
            list.sort((a, b) => b.usageCount - a.usageCount);
        } else if (sort === 'name') {
            list.sort((a, b) => a.title.localeCompare(b.title));
        }

        return list;
    });

    selectPlatform(platform: string): void {
        this.selectedPlatform.set(platform);
    }

    onSearch(event: Event): void {
        this.searchQuery.set((event.target as HTMLInputElement).value);
    }

    onSortChange(event: unknown): void {
        this.sortBy.set(event as string);
    }

    openDetail(template: RpaTemplate): void {
        this.selectedTemplate.set(template);
        this.detailVisible.set(true);
    }

    closeDetail(): void {
        this.detailVisible.set(false);
    }

    formatCount(count: number): string {
        if (count >= 1000) {
            return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return count.toString();
    }

    getPlatformColor(platform: string): string {
        return PLATFORM_COLORS[platform] || '#6B7280';
    }
}
